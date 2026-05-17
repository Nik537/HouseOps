import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { get, onValue, push, ref, remove, set, update } from 'firebase/database'
import {
  Bell,
  CalendarDays,
  Check,
  Heart,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { database, isFirebaseConfigured } from './firebase'
import './App.css'

type UserId = 'nik' | 'lucia' | 'gaj' | 'kaja'
type Preference = 'love' | 'like' | 'neutral' | 'dislike' | 'hard-no'

type Roommate = {
  id: UserId
  name: string
  initials: string
  color: string
}

type Chore = {
  id: string
  title: string
  area: string
  cadence: string
  minutes: number
  assigneeId: UserId
  dueDay: string
  dueTime: string
  ratings: Partial<Record<UserId, Preference>>
  done: boolean
  createdAt?: number
}

type NotificationSettings = {
  enabled: boolean
  leadMinutes: number
}

const HOUSEHOLD_ID = 'houseops-home'
const STORAGE_KEY = 'houseops-chores-v2'
const USER_KEY = 'houseops-current-user'
const NOTIFICATION_SETTINGS_KEY = 'houseops-notification-settings'

const roommates: Roommate[] = [
  { id: 'nik', name: 'Nik', initials: 'N', color: '#0f766e' },
  { id: 'lucia', name: 'Lucia', initials: 'L', color: '#d97706' },
  { id: 'gaj', name: 'Gaj', initials: 'G', color: '#dc2626' },
  { id: 'kaja', name: 'Kaja', initials: 'K', color: '#2563eb' },
]

const preferenceOptions: Array<{
  value: Preference
  label: string
  shortLabel: string
  score: string
}> = [
  { value: 'love', label: 'Zelo rad/a', shortLabel: 'Zelo rad/a', score: '2x' },
  { value: 'like', label: 'Rad/a', shortLabel: 'Rad/a', score: '+1' },
  { value: 'neutral', label: 'Vseeno', shortLabel: 'Vseeno', score: '0' },
  { value: 'dislike', label: 'Ne maram', shortLabel: 'Ne maram', score: '-1' },
  { value: 'hard-no', label: 'Res ne', shortLabel: 'Res ne', score: '!' },
]

const days = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
const dayLabels: Record<string, string> = {
  Pon: 'Ponedeljek',
  Tor: 'Torek',
  Sre: 'Sreda',
  Čet: 'Četrtek',
  Pet: 'Petek',
  Sob: 'Sobota',
  Ned: 'Nedelja',
}

const cadenceOptions = ['Dnevno', 'Tedensko', 'Dvakrat tedensko', 'Na dva tedna', 'Mesečno', 'Po potrebi']
const reminderLeadOptions = [
  { value: '0', label: 'Ob času opravila' },
  { value: '15', label: '15 minut prej' },
  { value: '30', label: '30 minut prej' },
  { value: '60', label: '1 uro prej' },
]

const starterChores: Omit<Chore, 'id'>[] = [
  starter('Kuhinjski reset', 'Kuhinja', 'Dnevno', 18, 'nik', 'Pon', '20:00'),
  starter('Očisti kopalnico', 'Kopalnica', 'Tedensko', 35, 'lucia', 'Sob', '11:00'),
  starter('Odnesi smeti', 'Smeti', 'Tor / Pet', 8, 'gaj', 'Tor', '21:00'),
  starter('Posesaj dnevno sobo', 'Dnevna soba', 'Tedensko', 22, 'kaja', 'Čet', '18:30'),
  starter('Pomij kuhinjska tla', 'Kuhinja', 'Tedensko', 20, 'nik', 'Ned', '17:00'),
  starter('Izprazni pomivalni stroj', 'Kuhinja', 'Dnevno', 7, 'lucia', 'Sre', '08:30'),
  starter('Obriši pulte', 'Kuhinja', 'Dnevno', 10, 'gaj', 'Pon', '21:00'),
  starter('Preglej hladilnik', 'Kuhinja', 'Mesečno', 25, 'kaja', 'Ned', '12:00'),
  starter('Odnesi reciklažo', 'Smeti', 'Tedensko', 10, 'nik', 'Sre', '19:30'),
  starter('Loči steklenice', 'Smeti', 'Na dva tedna', 12, 'lucia', 'Ned', '16:00'),
  starter('Uredi pralni kot', 'Pralnica', 'Tedensko', 16, 'gaj', 'Pet', '18:00'),
  starter('Operi kopalniške preproge', 'Kopalnica', 'Na dva tedna', 30, 'kaja', 'Sob', '13:00'),
  starter('Pobriši prah s polic', 'Dnevna soba', 'Tedensko', 18, 'nik', 'Pet', '17:30'),
  starter('Zamenjaj brisače za roke', 'Kopalnica', 'Dvakrat tedensko', 6, 'lucia', 'Čet', '09:00'),
  starter('Zalij rastline', 'Skupni prostori', 'Dvakrat tedensko', 9, 'gaj', 'Sob', '10:00'),
  starter('Dopolni toaletni papir', 'Kopalnica', 'Tedensko', 5, 'kaja', 'Sre', '18:00'),
  starter('Uredi čevlje v predsobi', 'Predsoba', 'Dnevno', 6, 'nik', 'Tor', '20:30'),
  starter('Operi odeje s kavča', 'Dnevna soba', 'Mesečno', 28, 'lucia', 'Ned', '14:00'),
  starter('Preveri osnovna živila', 'Kuhinja', 'Tedensko', 14, 'gaj', 'Pon', '18:00'),
  starter('Globinsko očisti štedilnik', 'Kuhinja', 'Tedensko', 24, 'kaja', 'Sob', '15:00'),
]

function App() {
  const [currentUserId, setCurrentUserId] = useState<UserId | null>(() => loadCurrentUser())
  const [chores, setChores] = useState<Chore[]>(() =>
    isFirebaseConfigured ? [] : loadLocalChores(),
  )
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [newTitle, setNewTitle] = useState('')
  const [newArea, setNewArea] = useState('Kuhinja')
  const [newCadence, setNewCadence] = useState('Tedensko')
  const [newAssignee, setNewAssignee] = useState<UserId>('nik')
  const [selectedDay, setSelectedDay] = useState('Pon')
  const [syncMode, setSyncMode] = useState<'firebase' | 'local'>(
    isFirebaseConfigured ? 'firebase' : 'local',
  )
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission(),
  )
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() =>
    loadNotificationSettings(),
  )

  const choresRef = useMemo(
    () => ref(database, `households/${HOUSEHOLD_ID}/chores`),
    [],
  )

  const currentUser = currentUserId
    ? roommates.find((roommate) => roommate.id === currentUserId) ?? null
    : null

  const seedFirebaseChores = useCallback(async () => {
    const existing = await get(choresRef)
    if (existing.exists()) return

    const seeded = starterChores.reduce<Record<string, Omit<Chore, 'id'>>>(
      (acc, chore, index) => {
        acc[`starter-${index + 1}`] = {
          ...chore,
          createdAt: Date.now() + index,
        }
        return acc
      },
      {},
    )
    await set(choresRef, seeded)
  }, [choresRef])

  useEffect(() => {
    if (!isFirebaseConfigured) return

    const unsubscribe = onValue(
      choresRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          await seedFirebaseChores()
          return
        }

        const choresById = snapshot.val() as Record<string, unknown>
        const nextChores = Object.entries(choresById)
          .map(([id, chore]) => normalizeChore(id, chore))
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))

        setChores(nextChores)
        setSyncMode('firebase')
        setLoading(false)
      },
      (error) => {
        console.warn('Firebase data sync unavailable, using local storage.', error)
        setChores(loadLocalChores())
        setSyncMode('local')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [choresRef, seedFirebaseChores])

  useEffect(() => {
    if (!loading && syncMode === 'local') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chores))
    }
  }, [chores, loading, syncMode])

  useEffect(() => {
    if (currentUserId) {
      window.localStorage.setItem(USER_KEY, currentUserId)
    }
  }, [currentUserId])

  useEffect(() => {
    window.localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(notificationSettings))
  }, [notificationSettings])

  useEffect(() => {
    if (!notificationSettings.enabled) return
    if (!currentUser || notificationPermission !== 'granted') return

    const timers = chores
      .filter((chore) => chore.assigneeId === currentUser.id && !chore.done)
      .map((chore) => {
        const delay = millisecondsUntilDue(chore.dueDay, chore.dueTime, notificationSettings.leadMinutes)
        if (delay < 0 || delay > 1000 * 60 * 60 * 8) return null

        const key = `${currentUser.id}-${chore.id}-${new Date().toDateString()}`
        if (window.sessionStorage.getItem(key)) return null

        return window.setTimeout(() => {
          window.sessionStorage.setItem(key, 'sent')
          showNotification('HouseOps opomnik', `${currentUser.name}, čas je za: ${chore.title}`)
        }, Math.max(delay, 1000))
      })
      .filter((timer): timer is number => timer !== null)

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [chores, currentUser, notificationPermission, notificationSettings])

  async function chooseUser(userId: UserId) {
    setCurrentUserId(userId)
    setNewAssignee(userId)
  }

  async function addChore() {
    const title = newTitle.trim()
    if (!title) return

    const chore: Omit<Chore, 'id'> = {
      title,
      area: newArea.trim() || 'Splošno',
      cadence: newCadence,
      minutes: 15,
      assigneeId: newAssignee,
      dueDay: selectedDay,
      dueTime: '18:00',
      ratings: currentUserId ? { [currentUserId]: 'neutral' } : {},
      done: false,
      createdAt: Date.now(),
    }

    if (syncMode === 'firebase' && isFirebaseConfigured) {
      const newChoreRef = push(choresRef)
      await set(newChoreRef, chore)
    } else {
      setChores((current) => [...current, { ...chore, id: crypto.randomUUID() }])
    }

    setNewTitle('')
  }

  async function updateChore(id: string, patch: Partial<Chore>) {
    if (syncMode === 'firebase' && isFirebaseConfigured) {
      await update(ref(database, `households/${HOUSEHOLD_ID}/chores/${id}`), patch)
      return
    }

    setChores((current) =>
      current.map((chore) => (chore.id === id ? { ...chore, ...patch } : chore)),
    )
  }

  async function rateChore(id: string, preference: Preference) {
    if (!currentUserId) return

    if (syncMode === 'firebase' && isFirebaseConfigured) {
      await set(
        ref(database, `households/${HOUSEHOLD_ID}/chores/${id}/ratings/${currentUserId}`),
        preference,
      )
      return
    }

    setChores((current) =>
      current.map((chore) =>
        chore.id === id
          ? { ...chore, ratings: { ...chore.ratings, [currentUserId]: preference } }
          : chore,
      ),
    )
  }

  async function removeChore(id: string) {
    if (syncMode === 'firebase' && isFirebaseConfigured) {
      await remove(ref(database, `households/${HOUSEHOLD_ID}/chores/${id}`))
      return
    }

    setChores((current) => current.filter((chore) => chore.id !== id))
  }

  async function resetStarters() {
    if (syncMode === 'firebase' && isFirebaseConfigured) {
      await set(choresRef, null)
      await seedFirebaseChores()
      return
    }

    setChores(withIds(starterChores))
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') {
      showNotification('Obvestila delujejo', 'HouseOps te lahko opomni na tvoja opravila.')
    }
  }

  const myChores = currentUser ? chores.filter((chore) => chore.assigneeId === currentUser.id) : []
  const selectedChores = myChores.filter((chore) => chore.dueDay === selectedDay)
  const upcomingChores = myChores
  const myCompletedCount = myChores.filter((chore) => chore.done).length
  const totalMinutes = myChores.reduce((sum, chore) => sum + chore.minutes, 0)
  const myChoresCount = myChores.length

  if (!currentUser) {
    return <LoginScreen onChoose={chooseUser} />
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Pregled stanovanja">
        <div>
          <h1>HouseOps</h1>
          <p>Skupni koledar opravil za stanovanje.</p>
        </div>
        <div className="profile-card">
          <span className="avatar" style={{ backgroundColor: currentUser.color }}>
            {currentUser.initials}
          </span>
          <div>
            <strong>{currentUser.name}</strong>
            <span>Nastavitve spodaj</span>
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Tedensko stanje">
        <StatusTile icon={<CalendarDays />} label="Moja opravila" value={myChoresCount.toString()} />
        <StatusTile icon={<Check />} label="Moje končano" value={`${myCompletedCount}/${myChoresCount}`} />
        <StatusTile icon={<UserRound />} label="Vsa opravila" value={chores.length.toString()} />
        <StatusTile icon={<Bell />} label="Minute" value={totalMinutes.toString()} />
      </section>

      <section className="panel today-panel">
        <div className="panel-heading">
          <div>
            <h2>Moja opravila</h2>
            <p>{syncMode === 'firebase' ? 'Sinhronizirano s Firebase' : 'Lokalni način'}</p>
          </div>
        </div>

        <div className="today-list">
          {loading ? (
            <p className="muted">Nalagam opravila...</p>
          ) : upcomingChores.length === 0 ? (
            <p className="muted">Trenutno nimaš dodeljenih opravil.</p>
          ) : (
            upcomingChores.map((chore) => (
              <ChoreRow
                chore={chore}
                currentUserId={currentUser.id}
                key={chore.id}
                readOnly
                onRate={rateChore}
                onUpdate={updateChore}
              />
            ))
          )}
        </div>
      </section>

      <section className="calendar-panel panel">
        <div className="panel-heading">
          <div>
            <h2>Moj tedenski koledar</h2>
            <p>Prikazana so samo opravila za {currentUser.name}.</p>
          </div>
        </div>

        <div className="day-strip" role="tablist" aria-label="Dnevi">
          {days.map((day) => {
            const dayCount = myChores.filter((chore) => chore.dueDay === day).length
            return (
              <button
                className={day === selectedDay ? 'day-pill active' : 'day-pill'}
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
              >
                <span>{day}</span>
                <strong>{dayCount}</strong>
              </button>
            )
          })}
        </div>

        <div className="calendar-list">
          {selectedChores.length === 0 ? (
            <p className="muted">Za {dayLabels[selectedDay]} ni opravil.</p>
          ) : (
            selectedChores.map((chore) => (
              <ChoreRow
                chore={chore}
                compact
                currentUserId={currentUser.id}
                key={chore.id}
                readOnly
                onRate={rateChore}
                onUpdate={updateChore}
              />
            ))
          )}
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Nastavitve</h2>
            <p>Profil, obvestila, ocene in opravila.</p>
          </div>
          <UserRound size={20} />
        </div>

        <div className="settings-section">
          <div className="settings-section-heading">
            <h3>Kdo sem?</h3>
            <p>Vse ocene in opomniki se vežejo na izbranega uporabnika.</p>
          </div>
          <div className="profile-switcher" aria-label="Izberi osebo">
            {roommates.map((roommate) => (
              <button
                className={roommate.id === currentUser.id ? 'person-button active' : 'person-button'}
                key={roommate.id}
                type="button"
                onClick={() => void chooseUser(roommate.id)}
              >
                <span className="avatar" style={{ backgroundColor: roommate.color }}>
                  {roommate.initials}
                </span>
                {roommate.name}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-heading">
            <h3>Obvestila</h3>
            <p>{notificationStatusText(notificationPermission)}</p>
          </div>
          <div className="notification-settings-grid">
            <label className="toggle-row">
              <input
                checked={notificationSettings.enabled}
                type="checkbox"
                onChange={(event) =>
                  setNotificationSettings((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              Opomniki so vklopljeni
            </label>
            <label>
              Kdaj naj opomni?
              <select
                value={notificationSettings.leadMinutes.toString()}
                onChange={(event) =>
                  setNotificationSettings((current) => ({
                    ...current,
                    leadMinutes: Number(event.target.value),
                  }))
                }
              >
                {reminderLeadOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="notification-actions">
              <button className="ghost-button" type="button" onClick={requestNotifications}>
                <Bell size={16} />
                Vklopi
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={notificationPermission !== 'granted'}
                onClick={() => showNotification('Test HouseOps', `${currentUser.name}, obvestila delujejo.`)}
              >
                Test
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-heading">
            <h3>Moja lestvica</h3>
            <p>{currentUser.name}, tako ocenjuješ opravila.</p>
            <Sparkles size={18} />
          </div>

          <div className="preference-grid">
            {preferenceOptions.map((option) => (
              <div className={`preference-card preference-${option.value}`} key={option.value}>
                <span>{option.label}</span>
                <strong>{option.score}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-heading">
            <h3>Nastavitve ocen</h3>
            <p>Ocene urejaš kot uporabnik {currentUser.name}.</p>
          </div>
          <div className="settings-ratings-list">
          {chores.map((chore) => (
            <div className="settings-rating-row" key={chore.id}>
              <div>
                <strong>{chore.title}</strong>
                <span>
                  {chore.area} · {chore.cadence} · {chore.dueDay} {chore.dueTime}
                </span>
              </div>
              <select
                aria-label={`Nastavitve: moja ocena za ${chore.title}`}
                value={chore.ratings?.[currentUser.id] ?? 'neutral'}
                onChange={(event) =>
                  void rateChore(chore.id, event.target.value as Preference)
                }
              >
                {preferenceOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          ))}
          </div>
        </div>

        <div className="settings-section manage-panel">
          <div className="settings-section-heading">
            <h3>Uredi pravila</h3>
            <p>Dodaj opravilo ali spremeni osebo, dan in pogostost.</p>
          </div>

          <form
          className="add-form"
          onSubmit={(event) => {
            event.preventDefault()
            void addChore()
          }}
        >
          <label>
            Opravilo
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Očisti balkon"
            />
          </label>
          <label>
            Prostor
            <input
              value={newArea}
              onChange={(event) => setNewArea(event.target.value)}
              placeholder="Skupni prostor"
            />
          </label>
          <label>
            Pogostost
            <select value={newCadence} onChange={(event) => setNewCadence(event.target.value)}>
              {cadenceOptions.map((cadence) => (
                <option value={cadence} key={cadence}>
                  {cadence}
                </option>
              ))}
            </select>
          </label>
          <label>
            Oseba
            <select
              value={newAssignee}
              onChange={(event) => setNewAssignee(event.target.value as UserId)}
            >
              {roommates.map((roommate) => (
                <option value={roommate.id} key={roommate.id}>
                  {roommate.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Dodaj
          </button>
          </form>
          <button className="ghost-button reset-button" type="button" onClick={resetStarters}>
            <RotateCcw size={16} />
            Ponastavi začetna opravila
          </button>

          <div className="all-chores">
          {chores.map((chore) => (
            <div className="manage-row" key={chore.id}>
              <div>
                <strong>{chore.title}</strong>
                <span>
                  {chore.area} · {chore.dueTime}
                </span>
              </div>
              <div className="manage-controls">
                <label>
                  Oseba
                  <select
                    value={chore.assigneeId}
                    onChange={(event) =>
                      void updateChore(chore.id, { assigneeId: event.target.value as UserId })
                    }
                  >
                    {roommates.map((roommate) => (
                      <option value={roommate.id} key={roommate.id}>
                        {roommate.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Dan
                  <select
                    value={chore.dueDay}
                    onChange={(event) => void updateChore(chore.id, { dueDay: event.target.value })}
                  >
                    {days.map((day) => (
                      <option value={day} key={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Pogostost
                  <select
                    value={chore.cadence}
                    onChange={(event) => void updateChore(chore.id, { cadence: event.target.value })}
                  >
                    {cadenceOptions.map((cadence) => (
                      <option value={cadence} key={cadence}>
                        {cadence}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                aria-label={`Izbriši ${chore.title}`}
                className="icon-button danger"
                type="button"
                onClick={() => void removeChore(chore.id)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function LoginScreen({ onChoose }: { onChoose: (userId: UserId) => Promise<void> }) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div>
          <h1>HouseOps</h1>
          <p>Izberi, kdo si. To lahko kasneje zamenjaš v aplikaciji.</p>
        </div>
        <div className="login-grid">
          {roommates.map((roommate) => (
            <button key={roommate.id} type="button" onClick={() => void onChoose(roommate.id)}>
              <span className="avatar large" style={{ backgroundColor: roommate.color }}>
                {roommate.initials}
              </span>
              <strong>{roommate.name}</strong>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function StatusTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="status-tile">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  )
}

function ChoreRow({
  chore,
  compact = false,
  currentUserId,
  readOnly = false,
  onDelete,
  onRate,
  onUpdate,
}: {
  chore: Chore
  compact?: boolean
  currentUserId: UserId
  readOnly?: boolean
  onDelete?: (id: string) => Promise<void>
  onRate: (id: string, preference: Preference) => Promise<void>
  onUpdate: (id: string, patch: Partial<Chore>) => Promise<void>
}) {
  const assignee = roommates.find((person) => person.id === chore.assigneeId) ?? roommates[0]
  const myRating = chore.ratings?.[currentUserId] ?? 'neutral'

  return (
    <article className={`${compact ? 'chore-row compact' : 'chore-row'}${readOnly ? ' read-only' : ''}`}>
      <button
        className={chore.done ? 'done-toggle complete' : 'done-toggle'}
        type="button"
        aria-label={`${chore.done ? 'Označi kot nedokončano' : 'Označi kot končano'}: ${chore.title}`}
        onClick={() => void onUpdate(chore.id, { done: !chore.done })}
      >
        <Check size={16} />
      </button>
      <div className="chore-main">
        <strong>{chore.title}</strong>
        <span>
          {chore.area} · {chore.cadence} · {chore.minutes} min
        </span>
      </div>
      {!readOnly && (
        <>
          <select
            aria-label={`Dodeli opravilo ${chore.title}`}
            value={chore.assigneeId}
            onChange={(event) => void onUpdate(chore.id, { assigneeId: event.target.value as UserId })}
          >
            {roommates.map((person) => (
              <option value={person.id} key={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select
            aria-label={`Moja ocena za ${chore.title}`}
            value={myRating}
            onChange={(event) => void onRate(chore.id, event.target.value as Preference)}
          >
            {preferenceOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.shortLabel}
              </option>
            ))}
          </select>
        </>
      )}
      <span className="owner-chip" style={{ borderColor: assignee.color }}>
        <Heart size={13} />
        {chore.dueDay} {chore.dueTime}
      </span>
      {!readOnly && onDelete && (
        <button
          aria-label={`Izbriši ${chore.title}`}
          className="icon-button danger"
          type="button"
          onClick={() => void onDelete(chore.id)}
        >
          <Trash2 size={16} />
        </button>
      )}
    </article>
  )
}

function starter(
  title: string,
  area: string,
  cadence: string,
  minutes: number,
  assigneeId: UserId,
  dueDay: string,
  dueTime: string,
): Omit<Chore, 'id'> {
  return {
    title,
    area,
    cadence,
    minutes,
    assigneeId,
    dueDay,
    dueTime,
    ratings: {},
    done: false,
  }
}

function withIds(chores: Omit<Chore, 'id'>[]): Chore[] {
  return chores.map((chore, index) => ({
    ...chore,
    id: `starter-${index + 1}`,
  }))
}

function loadLocalChores(): Chore[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored).map((chore: unknown, index: number) => normalizeChore(`local-${index}`, chore)) : withIds(starterChores)
  } catch {
    return withIds(starterChores)
  }
}

function loadCurrentUser(): UserId | null {
  const stored = window.localStorage.getItem(USER_KEY)
  return roommates.some((roommate) => roommate.id === stored) ? (stored as UserId) : null
}

function loadNotificationSettings(): NotificationSettings {
  try {
    const stored = window.localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
    const parsed = stored ? (JSON.parse(stored) as Partial<NotificationSettings>) : {}
    return {
      enabled: parsed.enabled ?? true,
      leadMinutes: typeof parsed.leadMinutes === 'number' ? parsed.leadMinutes : 15,
    }
  } catch {
    return {
      enabled: true,
      leadMinutes: 15,
    }
  }
}

function normalizeChore(id: string, value: unknown): Chore {
  const chore = value as Partial<Chore> & {
    ownerId?: UserId
    preference?: Preference
  }

  return {
    id,
    title: chore.title ?? 'Opravilo',
    area: chore.area ?? 'Splošno',
    cadence: chore.cadence ?? 'Tedensko',
    minutes: chore.minutes ?? 15,
    assigneeId: chore.assigneeId ?? chore.ownerId ?? 'nik',
    dueDay: days.includes(chore.dueDay ?? '') ? chore.dueDay ?? 'Pon' : 'Pon',
    dueTime: chore.dueTime ?? '18:00',
    ratings: chore.ratings ?? (chore.preference ? { nik: chore.preference } : {}),
    done: Boolean(chore.done),
    createdAt: chore.createdAt ?? Date.now(),
  }
}

function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function notificationStatusText(permission: NotificationPermission | 'unsupported') {
  if (permission === 'granted') return 'Vklopljeno. Opomniki se prikažejo za tvoja današnja opravila.'
  if (permission === 'denied') return 'Blokirano v brskalniku. Dovoli obvestila v nastavitvah strani.'
  if (permission === 'unsupported') return 'Ta brskalnik ne podpira obvestil.'
  return 'Vklopi obvestila in preizkusi testni opomnik.'
}

function showNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
  })
}

function millisecondsUntilDue(day: string, time: string, leadMinutes: number) {
  const now = new Date()
  const target = new Date(now)
  const [hours, minutes] = time.split(':').map(Number)
  const today = days[(now.getDay() + 6) % 7]
  if (day !== today || Number.isNaN(hours) || Number.isNaN(minutes)) return -1
  target.setHours(hours, minutes, 0, 0)
  target.setMinutes(target.getMinutes() - leadMinutes)
  return target.getTime() - now.getTime()
}

export default App
