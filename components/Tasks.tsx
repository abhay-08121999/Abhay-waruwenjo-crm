
import React, { useState } from 'react';
import { MOCK_TASKS, MOCK_LEADS } from '../constants.tsx';
import { TaskPriority } from '../types.ts';
import { Calendar, CheckCircle2, Circle, Clock, Filter, Plus, Search } from 'lucide-react';

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return 'text-red-600 bg-red-50';
      case TaskPriority.MEDIUM: return 'text-amber-600 bg-amber-50';
      case TaskPriority.LOW: return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Care Coordination</h2>
          <p className="text-slate-500 text-sm">Manage follow-ups and facility site visits.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm">
          <Plus size={18} />
          New Follow-up
        </button>
      </div>

      <div className="flex gap-4 p-1 bg-slate-100 rounded-xl w-fit">
        {(['all', 'pending', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-6 py-1.5 text-sm font-medium rounded-lg capitalize transition-all ${
              filter === tab ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredTasks.map((task) => {
          const lead = MOCK_LEADS.find(l => l.id === task.leadId);
          return (
            <div 
              key={task.id} 
              className={`group flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl transition-all hover:shadow-md hover:border-teal-200 ${
                task.completed ? 'opacity-75' : ''
              }`}
            >
              <button 
                onClick={() => toggleTask(task.id)}
                className={`transition-colors ${task.completed ? 'text-teal-500' : 'text-slate-300 group-hover:text-teal-400'}`}
              >
                {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h4 className={`text-sm font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    {task.title}
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                {lead && (
                  <p className="text-xs text-slate-500 mt-1">
                    Related to: <span className="font-medium text-teal-600">{lead.name} ({lead.company})</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Calendar size={14} />
                  {task.dueDate}
                </div>
                {!task.completed && (
                   <span className="text-[10px] font-bold text-teal-500 uppercase tracking-tight">Active</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tasks;
