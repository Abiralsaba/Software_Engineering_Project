import { useCallback, useEffect, useMemo, useState } from 'react';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import Modal from '../../components/Modal.jsx';
import RouteLoading from '../../components/RouteLoading.jsx';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

const columns = [
  ['todo', 'To Do', 'amber'],
  ['progress', 'In Progress', 'blue'],
  ['done', 'Done', 'green']
];

function apiDate(value) {
  return value ? new Date(value).toISOString().slice(0, 19).replace('T', ' ') : null;
}

function calendarCells(month) {
  const year = month.getFullYear(); const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
}

export default function TodoPage() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const { submitting, runLocked } = useSubmissionLock();

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await apiRequest('/api/dashboard/todos');
      setTodos(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await runLocked(async () => {
      try {
        const created = await apiRequest('/api/dashboard/todos', {
          method: 'POST',
          body: {
            title: values.get('title'),
            description: values.get('description'),
            due_date: apiDate(values.get('due_date'))
          }
        });
        setTodos(current => [created, ...current]);
        setModal(null);
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  async function move(id, status) {
    const task = todos.find(row => row.id === id);
    if (!task || task.status === status) return;
    const previous = todos;
    setTodos(current => current.map(row => row.id === id ? { ...row, status } : row));
    try {
      await apiRequest(`/api/dashboard/todos/${id}/move`, { method: 'PUT', body: { status } });
    } catch (requestError) {
      setTodos(previous);
      setError(requestError.message);
    }
  }

  async function remove(id) {
    await runLocked(async () => {
      try {
        await apiRequest(`/api/dashboard/todos/${id}`, { method: 'DELETE' });
        setTodos(current => current.filter(row => row.id !== id));
        setModal(null);
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  const dueByDay = useMemo(() => todos.filter(row => row.due_date).reduce((map, task) => {
    const due = new Date(task.due_date);
    if (due.getFullYear() === calendarMonth.getFullYear() && due.getMonth() === calendarMonth.getMonth()) {
      const day = due.getDate(); map[day] = [...(map[day] || []), task];
    }
    return map;
  }, {}), [todos, calendarMonth]);

  return (
    <CitizenShell pageStyles={['/css/todo.css']}>
      <header className="react-page-header"><div><h1>My To-Do List</h1><p>Manage tasks, priorities and due dates.</p></div><button className="btn-primary react-auto-width" type="button" onClick={() => setModal({ type: 'create' })}><i className="fas fa-plus" /> Add Item</button></header>
      {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={load}>Retry</button></div>}
      {loading ? <RouteLoading label="Loading tasks…" /> : <>
        <div className="kanban-board react-kanban-board">{columns.map(([status, label, color]) => <section className="kanban-column" onDragOver={event => event.preventDefault()} onDrop={event => move(Number(event.dataTransfer.getData('text/task-id')), status)} key={status}><div className={`kanban-header react-kanban-${color}`}>{label}<span>{todos.filter(row => row.status === status).length}</span></div><div className="kanban-list">{todos.filter(row => row.status === status).map(task => <button className="kanban-item react-kanban-item" draggable onDragStart={event => event.dataTransfer.setData('text/task-id', String(task.id))} onClick={() => setModal({ type: 'detail', task })} type="button" key={task.id}><strong>{task.title}</strong>{task.due_date && <time>{new Date(task.due_date).toLocaleString()}</time>}</button>)}{!todos.some(row => row.status === status) && <p className="react-column-empty">Drop tasks here</p>}</div></section>)}</div>
        <section className="react-calendar-panel react-task-calendar" aria-label="Task calendar"><header><button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>‹</button><h2>{calendarMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2><button type="button" aria-label="Next month" onClick={() => setCalendarMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>›</button></header><div className="react-calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <strong key={day}>{day}</strong>)}</div><div className="react-calendar-days">{calendarCells(calendarMonth).map((day, index) => <div className={!day ? 'empty' : ''} key={`${day || 'empty'}-${index}`}>{day && <><span>{day}</span>{(dueByDay[day] || []).map(task => <button className={`react-calendar-task react-calendar-${task.status}`} type="button" key={task.id} onClick={() => setModal({ type: 'detail', task })}>{task.title}</button>)}</>}</div>)}</div></section>
      </>}
      {modal?.type === 'create' && <Modal title="New Task" onClose={() => setModal(null)}><form className="react-form-stack" onSubmit={create}><label>Task Title<input name="title" required /></label><label>Description<textarea name="description" rows="4" /></label><label>Due Date & Time<input name="due_date" type="datetime-local" /></label><button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Creating…' : 'Create Task'}</button></form></Modal>}
      {modal?.type === 'detail' && <Modal title={modal.task.title} onClose={() => setModal(null)}><p>{modal.task.description || 'No description provided.'}</p>{modal.task.due_date && <p><strong>Due:</strong> {new Date(modal.task.due_date).toLocaleString()}</p>}<div className="react-modal-actions"><select aria-label="Task status" value={modal.task.status} onChange={event => { move(modal.task.id, event.target.value); setModal(current => ({ ...current, task: { ...current.task, status: event.target.value } })); }}><option value="todo">To Do</option><option value="progress">In Progress</option><option value="done">Done</option></select><button className="btn-danger" disabled={submitting} type="button" onClick={() => remove(modal.task.id)}><i className="fas fa-trash" /> Delete</button></div></Modal>}
    </CitizenShell>
  );
}
