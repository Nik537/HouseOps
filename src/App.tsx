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
  intervalDays?: number | null
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
  reminderTime: string
}

const HOUSEHOLD_ID = 'houseops-home'
const STORAGE_KEY = 'houseops-chores-v2'
const USER_KEY = 'houseops-current-user'
const NOTIFICATION_SETTINGS_KEY = 'houseops-notification-settings'
const LJUBLJANA_TIME_ZONE = 'Europe/Ljubljana'
const CUSTOM_CADENCE_VALUE = 'custom'

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

const cadenceOptions = ['Dnevno', 'Tedensko', 'Dvakrat tedensko', 'Na dva tedna', 'Mesečno']

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
  const [newCustomCadenceDays, setNewCustomCadenceDays] = useState(10)
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
        const delay = millisecondsUntilLjubljanaReminder(chore.dueDay, notificationSettings.reminderTime)
        if (delay < 0 || delay > 1000 * 60 * 60 * 24) return null

        const key = `${currentUser.id}-${chore.id}-${getLjubljanaDateKey()}-${notificationSettings.reminderTime}`
        if (window.sessionStorage.getItem(key)) return null

        return window.setTimeout(() => {
          window.sessionStorage.setItem(key, 'sent')
          showNotification(
            'HouseOps opomnik',
            `${currentUser.name}, danes po ljubljanskem času: ${chore.title}`,
          )
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
      cadence: newCadence === CUSTOM_CADENCE_VALUE ? 'Po meri' : newCadence,
      intervalDays: newCadence === CUSTOM_CADENCE_VALUE ? clampDays(newCustomCadenceDays) : null,
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
              Ura opomnika
              <input
                aria-label="Ura opomnika po ljubljanskem času"
                type="time"
                value={notificationSettings.reminderTime}
                onChange={(event) =>
                  setNotificationSettings((current) => ({
                    ...current,
                    reminderTime: event.target.value,
                  }))
                }
              />
              <span>Ljubljana čas</span>
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
                  {chore.area} · {formatCadence(chore)} · {chore.dueDay} {chore.dueTime}
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
              {[...cadenceOptions, CUSTOM_CADENCE_VALUE].map((cadence) => (
                <option value={cadence} key={cadence}>
                  {cadence === CUSTOM_CADENCE_VALUE ? 'Po meri' : cadence}
                </option>
              ))}
            </select>
          </label>
          {newCadence === CUSTOM_CADENCE_VALUE && (
            <label>
              Na koliko dni?
              <input
                min="1"
                max="365"
                type="number"
                value={newCustomCadenceDays}
                onChange={(event) => setNewCustomCadenceDays(clampDays(event.target.value))}
              />
            </label>
          )}
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
                  {chore.area} · {formatCadence(chore)} · {chore.dueTime}
                </span>
              </div>
              <div className="rating-summary" aria-label={`Ocene za ${chore.title}`}>
                {roommates.map((roommate) => (
                  <span className="rating-pill" key={roommate.id}>
                    <span className="mini-avatar" style={{ backgroundColor: roommate.color }}>
                      {roommate.initials}
                    </span>
                    {preferenceLabel(chore.ratings?.[roommate.id])}
                  </span>
                ))}
              </div>
              <div className="manage-controls">
                <label className="done-field">
                  Končano
                  <input
                    checked={chore.done}
                    type="checkbox"
                    onChange={(event) => void updateChore(chore.id, { done: event.target.checked })}
                  />
                </label>
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
                    value={cadenceSelectValue(chore)}
                    onChange={(event) =>
                      void updateChore(chore.id, {
                        cadence:
                          event.target.value === CUSTOM_CADENCE_VALUE
                            ? 'Po meri'
                            : event.target.value,
                        intervalDays:
                          event.target.value === CUSTOM_CADENCE_VALUE
                            ? customCadenceDays(chore)
                            : null,
                      })
                    }
                  >
                    {[...cadenceOptions, CUSTOM_CADENCE_VALUE].map((cadence) => (
                      <option value={cadence} key={cadence}>
                        {cadence === CUSTOM_CADENCE_VALUE ? 'Po meri' : cadence}
                      </option>
                    ))}
                  </select>
                </label>
                {isCustomCadence(chore) && (
                  <label>
                    Dni
                    <input
                      min="1"
                      max="365"
                      type="number"
                      value={customCadenceDays(chore)}
                      onChange={(event) =>
                        void updateChore(chore.id, {
                          cadence: 'Po meri',
                          intervalDays: clampDays(event.target.value),
                        })
                      }
                    />
                  </label>
                )}
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
      <label className={chore.done ? 'done-check complete' : 'done-check'}>
        <input
          checked={chore.done}
          type="checkbox"
          aria-label={`Končano: ${chore.title}`}
          onChange={(event) => void onUpdate(chore.id, { done: event.target.checked })}
        />
        <span>
          <Check size={15} />
        </span>
        Končano
      </label>
      <div className="chore-main">
        <strong>{chore.title}</strong>
        <span>
          {chore.area} · {formatCadence(chore)} · {chore.minutes} min
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
    intervalDays: null,
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
    const parsed = stored
      ? (JSON.parse(stored) as Partial<NotificationSettings> & { leadMinutes?: number })
      : {}
    return {
      enabled: parsed.enabled ?? true,
      reminderTime: isValidTime(parsed.reminderTime) ? parsed.reminderTime : '09:00',
    }
  } catch {
    return {
      enabled: true,
      reminderTime: '09:00',
    }
  }
}

function normalizeChore(id: string, value: unknown): Chore {
  const chore = value as Partial<Chore> & {
    ownerId?: UserId
    preference?: Preference
  }
  const normalizedCadence = normalizeCadence(chore.cadence)

  return {
    id,
    title: chore.title ?? 'Opravilo',
    area: chore.area ?? 'Splošno',
    cadence: normalizedCadence.cadence,
    intervalDays: normalizedCadence.intervalDays ?? validIntervalDays(chore.intervalDays),
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
  if (permission === 'granted') return 'Vklopljeno. Opomniki se prikažejo ob izbrani uri po ljubljanskem času.'
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

function preferenceLabel(preference?: Preference) {
  return preferenceOptions.find((option) => option.value === preference)?.shortLabel ?? 'Brez'
}

function formatCadence(chore: Pick<Chore, 'cadence' | 'intervalDays'>) {
  return isCustomCadence(chore) ? customCadenceLabel(customCadenceDays(chore)) : chore.cadence
}

function cadenceSelectValue(chore: Pick<Chore, 'cadence' | 'intervalDays'>) {
  return isCustomCadence(chore) ? CUSTOM_CADENCE_VALUE : chore.cadence
}

function isCustomCadence(chore: Pick<Chore, 'cadence' | 'intervalDays'>) {
  return chore.cadence === 'Po meri' || validIntervalDays(chore.intervalDays) !== null
}

function customCadenceDays(chore: Pick<Chore, 'cadence' | 'intervalDays'>) {
  return validIntervalDays(chore.intervalDays) ?? 10
}

function customCadenceLabel(daysValue: number) {
  return `Vsakih ${clampDays(daysValue)} dni`
}

function normalizeCadence(cadence?: string) {
  if (!cadence || cadence === 'Po potrebi') {
    return { cadence: 'Po meri', intervalDays: 10 }
  }

  const match = cadence.match(/^Vsakih (\d+) dni$/)
  if (match) {
    return { cadence: 'Po meri', intervalDays: clampDays(match[1]) }
  }

  return {
    cadence: cadenceOptions.includes(cadence) || cadence === 'Po meri' ? cadence : 'Tedensko',
    intervalDays: null,
  }
}

function validIntervalDays(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return clampDays(value)
}

function clampDays(value: string | number) {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return 1
  return Math.min(365, Math.max(1, Math.round(parsed)))
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
}

function millisecondsUntilLjubljanaReminder(day: string, time: string) {
  const now = new Date()
  const today = getLjubljanaDay()
  const [hours, minutes] = time.split(':').map(Number)
  if (day !== today || Number.isNaN(hours) || Number.isNaN(minutes)) return -1
  const parts = getLjubljanaDateParts(now)
  const target = zonedDateTimeToDate(parts.year, parts.month, parts.day, hours, minutes)
  return target.getTime() - now.getTime()
}

function getLjubljanaDay() {
  const parts = getLjubljanaDateParts(new Date())
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return days[(date.getUTCDay() + 6) % 7]
}

function getLjubljanaDateKey() {
  const parts = getLjubljanaDateParts(new Date())
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getLjubljanaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: LJUBLJANA_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date)

  return {
    day: Number(parts.find((part) => part.type === 'day')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    year: Number(parts.find((part) => part.type === 'year')?.value),
  }
}

function zonedDateTimeToDate(year: number, month: number, day: number, hours: number, minutes: number) {
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
  const offset = getTimeZoneOffset(new Date(utcGuess))
  return new Date(utcGuess - offset)
}

function getTimeZoneOffset(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: LJUBLJANA_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )
  return asUtc - date.getTime()
}

export default App
