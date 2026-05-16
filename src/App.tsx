import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from 'firebase/database'
import {
  Bell,
  CalendarDays,
  Check,
  Heart,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { database, isFirebaseConfigured } from './firebase'
import './App.css'

type Preference = 'love' | 'like' | 'neutral' | 'dislike' | 'hard-no'

type Roommate = {
  id: string
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
  ownerId: string
  dueDay: string
  dueTime: string
  preference: Preference
  done: boolean
  createdAt?: number
}

const HOUSEHOLD_ID = 'houseops-home'
const STORAGE_KEY = 'houseops-chores-v1'

const roommates: Roommate[] = [
  { id: 'nik', name: 'Nik', initials: 'N', color: '#0f766e' },
  { id: 'ana', name: 'Ana', initials: 'A', color: '#d97706' },
  { id: 'luka', name: 'Luka', initials: 'L', color: '#dc2626' },
  { id: 'sara', name: 'Sara', initials: 'S', color: '#2563eb' },
]

const preferenceOptions: Array<{
  value: Preference
  label: string
  score: string
}> = [
  { value: 'love', label: 'Love', score: '2x' },
  { value: 'like', label: 'Like', score: '+1' },
  { value: 'neutral', label: 'Neutral', score: '0' },
  { value: 'dislike', label: 'Dislike', score: '-1' },
  { value: 'hard-no', label: 'Hard no', score: '!' },
]

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const starterChores: Omit<Chore, 'id'>[] = [
  {
    title: 'Kitchen reset',
    area: 'Kitchen',
    cadence: 'Daily',
    minutes: 18,
    ownerId: 'nik',
    dueDay: 'Mon',
    dueTime: '20:00',
    preference: 'like',
    done: false,
  },
  {
    title: 'Bathroom scrub',
    area: 'Bathroom',
    cadence: 'Weekly',
    minutes: 35,
    ownerId: 'ana',
    dueDay: 'Sat',
    dueTime: '11:00',
    preference: 'dislike',
    done: false,
  },
  {
    title: 'Trash run',
    area: 'Bins',
    cadence: 'Tue / Fri',
    minutes: 8,
    ownerId: 'luka',
    dueDay: 'Tue',
    dueTime: '21:00',
    preference: 'neutral',
    done: false,
  },
  {
    title: 'Vacuum living room',
    area: 'Living room',
    cadence: 'Weekly',
    minutes: 22,
    ownerId: 'sara',
    dueDay: 'Thu',
    dueTime: '18:30',
    preference: 'like',
    done: false,
  },
  {
    title: 'Mop kitchen floor',
    area: 'Kitchen',
    cadence: 'Weekly',
    minutes: 20,
    ownerId: 'nik',
    dueDay: 'Sun',
    dueTime: '17:00',
    preference: 'neutral',
    done: false,
  },
  {
    title: 'Unload dishwasher',
    area: 'Kitchen',
    cadence: 'Daily',
    minutes: 7,
    ownerId: 'ana',
    dueDay: 'Wed',
    dueTime: '08:30',
    preference: 'love',
    done: false,
  },
  {
    title: 'Wipe counters',
    area: 'Kitchen',
    cadence: 'Daily',
    minutes: 10,
    ownerId: 'luka',
    dueDay: 'Mon',
    dueTime: '21:00',
    preference: 'like',
    done: false,
  },
  {
    title: 'Clean fridge shelf',
    area: 'Kitchen',
    cadence: 'Monthly',
    minutes: 25,
    ownerId: 'sara',
    dueDay: 'Sun',
    dueTime: '12:00',
    preference: 'hard-no',
    done: false,
  },
  {
    title: 'Take recycling out',
    area: 'Bins',
    cadence: 'Weekly',
    minutes: 10,
    ownerId: 'nik',
    dueDay: 'Wed',
    dueTime: '19:30',
    preference: 'neutral',
    done: false,
  },
  {
    title: 'Sort glass bottles',
    area: 'Bins',
    cadence: 'Biweekly',
    minutes: 12,
    ownerId: 'ana',
    dueDay: 'Sun',
    dueTime: '16:00',
    preference: 'dislike',
    done: false,
  },
  {
    title: 'Laundry room tidy',
    area: 'Laundry',
    cadence: 'Weekly',
    minutes: 16,
    ownerId: 'luka',
    dueDay: 'Fri',
    dueTime: '18:00',
    preference: 'like',
    done: false,
  },
  {
    title: 'Wash bath mats',
    area: 'Bathroom',
    cadence: 'Biweekly',
    minutes: 30,
    ownerId: 'sara',
    dueDay: 'Sat',
    dueTime: '13:00',
    preference: 'neutral',
    done: false,
  },
  {
    title: 'Dust shelves',
    area: 'Living room',
    cadence: 'Weekly',
    minutes: 18,
    ownerId: 'nik',
    dueDay: 'Fri',
    dueTime: '17:30',
    preference: 'dislike',
    done: false,
  },
  {
    title: 'Change hand towels',
    area: 'Bathroom',
    cadence: 'Twice weekly',
    minutes: 6,
    ownerId: 'ana',
    dueDay: 'Thu',
    dueTime: '09:00',
    preference: 'love',
    done: false,
  },
  {
    title: 'Water plants',
    area: 'Common areas',
    cadence: 'Twice weekly',
    minutes: 9,
    ownerId: 'luka',
    dueDay: 'Sat',
    dueTime: '10:00',
    preference: 'love',
    done: false,
  },
  {
    title: 'Restock toilet paper',
    area: 'Bathroom',
    cadence: 'Weekly',
    minutes: 5,
    ownerId: 'sara',
    dueDay: 'Wed',
    dueTime: '18:00',
    preference: 'neutral',
    done: false,
  },
  {
    title: 'Entryway shoes reset',
    area: 'Hallway',
    cadence: 'Daily',
    minutes: 6,
    ownerId: 'nik',
    dueDay: 'Tue',
    dueTime: '20:30',
    preference: 'like',
    done: false,
  },
  {
    title: 'Wash couch blankets',
    area: 'Living room',
    cadence: 'Monthly',
    minutes: 28,
    ownerId: 'ana',
    dueDay: 'Sun',
    dueTime: '14:00',
    preference: 'neutral',
    done: false,
  },
  {
    title: 'Grocery staples check',
    area: 'Kitchen',
    cadence: 'Weekly',
    minutes: 14,
    ownerId: 'luka',
    dueDay: 'Mon',
    dueTime: '18:00',
    preference: 'like',
    done: false,
  },
  {
    title: 'Deep clean stovetop',
    area: 'Kitchen',
    cadence: 'Weekly',
    minutes: 24,
    ownerId: 'sara',
    dueDay: 'Sat',
    dueTime: '15:00',
    preference: 'hard-no',
    done: false,
  },
]

function App() {
  const [chores, setChores] = useState<Chore[]>(() =>
    isFirebaseConfigured ? [] : loadLocalChores(),
  )
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [newTitle, setNewTitle] = useState('')
  const [newArea, setNewArea] = useState('Kitchen')
  const [newOwner, setNewOwner] = useState(roommates[0].id)
  const [selectedDay, setSelectedDay] = useState('Mon')
  const [syncMode, setSyncMode] = useState<'firebase' | 'local'>(
    isFirebaseConfigured ? 'firebase' : 'local',
  )

  const choresRef = useMemo(
    () => ref(database, `households/${HOUSEHOLD_ID}/chores`),
    [],
  )

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
    if (!isFirebaseConfigured) {
      return
    }

    const unsubscribe = onValue(
      choresRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          await seedFirebaseChores()
          return
        }

        const choresById = snapshot.val() as Record<string, Omit<Chore, 'id'>>
        const nextChores = Object.entries(choresById)
          .map(([id, chore]) => ({ ...chore, id }))
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))

        setChores(nextChores)
        setSyncMode('firebase')
        setLoading(false)
      },
      (error) => {
        console.warn('Firebase data sync unavailable, using local storage.', error)
        const stored = window.localStorage.getItem(STORAGE_KEY)
        setChores(stored ? JSON.parse(stored) : withIds(starterChores))
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

  async function addChore() {
    const title = newTitle.trim()
    if (!title) return

    const chore: Omit<Chore, 'id'> = {
      title,
      area: newArea.trim() || 'General',
      cadence: 'Weekly',
      minutes: 15,
      ownerId: newOwner,
      dueDay: selectedDay,
      dueTime: '18:00',
      preference: 'neutral',
      done: false,
    }

    if (syncMode === 'firebase' && isFirebaseConfigured) {
      const newChoreRef = push(choresRef)
      await set(newChoreRef, { ...chore, createdAt: Date.now() })
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

  const selectedChores = chores.filter((chore) => chore.dueDay === selectedDay)
  const todayChores = chores.filter((chore) => ['Mon', 'Tue', 'Wed'].includes(chore.dueDay))
  const completedCount = chores.filter((chore) => chore.done).length
  const totalMinutes = chores.reduce((sum, chore) => sum + chore.minutes, 0)

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Household overview">
        <div>
          <h1>HouseOps</h1>
          <p>Shared chores for a four-person apartment.</p>
        </div>
        <div className="roommate-stack" aria-label="Roommates">
          {roommates.map((roommate) => (
            <span
              className="avatar"
              key={roommate.id}
              style={{ backgroundColor: roommate.color }}
              title={roommate.name}
            >
              {roommate.initials}
            </span>
          ))}
        </div>
      </section>

      <section className="stats-grid" aria-label="Weekly status">
        <StatusTile icon={<CalendarDays />} label="Chores" value={chores.length.toString()} />
        <StatusTile icon={<Check />} label="Done" value={`${completedCount}/${chores.length}`} />
        <StatusTile icon={<Users />} label="People" value="4" />
        <StatusTile icon={<Bell />} label="Minutes" value={totalMinutes.toString()} />
      </section>

      <section className="panel today-panel">
        <div className="panel-heading">
          <div>
            <h2>Today and next up</h2>
            <p>{syncMode === 'firebase' ? 'Synced with Firebase' : 'Local draft mode'}</p>
          </div>
          <button className="ghost-button" type="button" onClick={resetStarters}>
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <div className="today-list">
          {loading ? (
            <p className="muted">Loading chores...</p>
          ) : (
            todayChores.slice(0, 5).map((chore) => (
              <ChoreRow
                chore={chore}
                key={chore.id}
                onDelete={removeChore}
                onUpdate={updateChore}
              />
            ))
          )}
        </div>
      </section>

      <section className="calendar-panel panel">
        <div className="panel-heading">
          <div>
            <h2>Week calendar</h2>
            <p>Tap a day to inspect the rotation.</p>
          </div>
        </div>

        <div className="day-strip" role="tablist" aria-label="Days">
          {days.map((day) => {
            const dayCount = chores.filter((chore) => chore.dueDay === day).length
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
            <p className="muted">No chores on {selectedDay} yet.</p>
          ) : (
            selectedChores.map((chore) => (
              <ChoreRow
                chore={chore}
                compact
                key={chore.id}
                onDelete={removeChore}
                onUpdate={updateChore}
              />
            ))
          )}
        </div>
      </section>

      <section className="panel preferences-panel">
        <div className="panel-heading">
          <div>
            <h2>Preference voting</h2>
            <p>Use this to make the next rotation less annoying.</p>
          </div>
          <Sparkles size={20} />
        </div>

        <div className="preference-grid">
          {preferenceOptions.map((option) => (
            <button
              className={`preference-card preference-${option.value}`}
              key={option.value}
              type="button"
            >
              <span>{option.label}</span>
              <strong>{option.score}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel manage-panel">
        <div className="panel-heading">
          <div>
            <h2>Manage chores</h2>
            <p>Add anything missing. Delete chores that no longer matter.</p>
          </div>
        </div>

        <form
          className="add-form"
          onSubmit={(event) => {
            event.preventDefault()
            void addChore()
          }}
        >
          <label>
            Chore
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Clean balcony"
            />
          </label>
          <label>
            Area
            <input
              value={newArea}
              onChange={(event) => setNewArea(event.target.value)}
              placeholder="Common area"
            />
          </label>
          <label>
            Person
            <select value={newOwner} onChange={(event) => setNewOwner(event.target.value)}>
              {roommates.map((roommate) => (
                <option value={roommate.id} key={roommate.id}>
                  {roommate.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Add
          </button>
        </form>

        <div className="all-chores">
          {chores.map((chore) => (
            <div className="manage-row" key={chore.id}>
              <div>
                <strong>{chore.title}</strong>
                <span>
                  {chore.area} · {chore.cadence}
                </span>
              </div>
              <button
                aria-label={`Delete ${chore.title}`}
                className="icon-button danger"
                type="button"
                onClick={() => void removeChore(chore.id)}
              >
                <Trash2 size={17} />
              </button>
            </div>
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
  onDelete,
  onUpdate,
}: {
  chore: Chore
  compact?: boolean
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, patch: Partial<Chore>) => Promise<void>
}) {
  const roommate = roommates.find((person) => person.id === chore.ownerId) ?? roommates[0]

  return (
    <article className={compact ? 'chore-row compact' : 'chore-row'}>
      <button
        className={chore.done ? 'done-toggle complete' : 'done-toggle'}
        type="button"
        aria-label={`Mark ${chore.title} ${chore.done ? 'not done' : 'done'}`}
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
      <select
        aria-label={`Assign ${chore.title}`}
        value={chore.ownerId}
        onChange={(event) => void onUpdate(chore.id, { ownerId: event.target.value })}
      >
        {roommates.map((person) => (
          <option value={person.id} key={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      <select
        aria-label={`Preference for ${chore.title}`}
        value={chore.preference}
        onChange={(event) =>
          void onUpdate(chore.id, { preference: event.target.value as Preference })
        }
      >
        {preferenceOptions.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="owner-chip" style={{ borderColor: roommate.color }}>
        <Heart size={13} />
        {chore.dueDay} {chore.dueTime}
      </span>
      <button
        aria-label={`Delete ${chore.title}`}
        className="icon-button danger"
        type="button"
        onClick={() => void onDelete(chore.id)}
      >
        <Trash2 size={16} />
      </button>
    </article>
  )
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
    return stored ? JSON.parse(stored) : withIds(starterChores)
  } catch {
    return withIds(starterChores)
  }
}

export default App
