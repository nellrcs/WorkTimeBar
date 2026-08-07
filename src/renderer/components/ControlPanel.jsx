import React, { useState, useEffect } from 'react';
import logoImg from '../../img/logotipo.png';
import faviconImg from '../../favicon.ico';

// Helpers
function convertSecondsToHour(seconds) {
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor((seconds % 3600) / 60);
  let remainingSeconds = seconds % 60;
  if (hours > 0) {
    return (`00${Math.floor(hours)}`).slice(-2) + ":" + (`00${Math.floor(minutes)}`).slice(-2) + ":" + (`00${Math.floor(remainingSeconds)}`).slice(-2) + "h";
  } else if (!hours && minutes > 0) {
    return "00:" + (`00${Math.floor(minutes)}`).slice(-2) + ":" + (`00${Math.floor(remainingSeconds)}`).slice(-2) + "h";
  }
  return "00:00:" + (`00${Math.floor(remainingSeconds)}`).slice(-2) + "h";
}

function convertFloatToHours(time) {
  const hours = parseFloat(time) || 0;
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const displayHours = h >= 100 ? (`000${h}`).slice(-3) : (`00${h}`).slice(-2);
  const displayMinutes = (`00${m}`).slice(-2);
  return `${displayHours}:${displayMinutes}h`;
}

function convertFloatToSeconds(time) {
  return Math.floor(time * 3600);
}

function computeWorkdayHours(startStr, endStr, breakHours) {
  if (!startStr || !endStr) return 8;
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  if (isNaN(sH) || isNaN(eH)) return 8;
  
  let startMinutes = sH * 60 + (sM || 0);
  let endMinutes = eH * 60 + (eM || 0);
  
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const grossMinutes = endMinutes - startMinutes;
  const breakMinutes = (parseFloat(breakHours) || 0) * 60;
  const netMinutes = Math.max(60, grossMinutes - breakMinutes);
  const netHours = Math.round((netMinutes / 60) * 10) / 10;
  return netHours;
}

export default function ControlPanel() {
  const [socket, setSocket] = useState(null);
  const [offline, setOffline] = useState(false);

  // Form states
  const [dayTotalHours, setDayTotalHours] = useState(8);
  const [workdayStart, setWorkdayStart] = useState('08:00');
  const [workdayEnd, setWorkdayEnd] = useState('17:00');
  const [lunchBreak, setLunchBreak] = useState(1.0);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState(0);
  const [isFixed, setIsFixed] = useState(false);

  // List & stats states
  const [tasks, setTasks] = useState([]);

  // Modal state
  const [modal, setModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  const showModal = (type, title, message, onConfirm = null) => {
    setModal({ open: true, type, title, message, onConfirm });
  };

  const closeModal = () => {
    setModal({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  };

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // Checkpoints Modal state
  const [checkpointModalTask, setCheckpointModalTask] = useState(null);

  // Connect socket.io
  useEffect(() => {
    let hasSynced = false;
    const ioInstance = window.io ? window.io() : null;
    if (ioInstance) {
      setSocket(ioInstance);

      ioInstance.on('sync-store', (serverStore) => {
        const savedTasks = localStorage.getItem('tarefas');
        let localTasks = [];
        try { localTasks = JSON.parse(savedTasks) || []; } catch(e) {}

        if (!hasSynced && serverStore.tasks.length === 0 && localTasks.length > 0) {
          hasSynced = true;
          const localHours = parseFloat(localStorage.getItem('meta_horas')) || 8;
          ioInstance.emit('save-store', { tasks: localTasks, dayTotalHours: localHours });
          setTasks(localTasks);
          setDayTotalHours(localHours);
        } else {
          hasSynced = true;
          setTasks(serverStore.tasks || []);
          setDayTotalHours(serverStore.dayTotalHours || 8);
          localStorage.setItem('tarefas', JSON.stringify(serverStore.tasks || []));
          localStorage.setItem('meta_horas', (serverStore.dayTotalHours || 8).toString());
          setCheckpointModalTask((prev) => {
            if (!prev) return null;
            return (serverStore.tasks || []).find(t => t.id === prev.id) || null;
          });
        }
      });

      ioInstance.on('update', (arg) => {
        setTasks((prevTasks) => {
          const updated = prevTasks.map((t) => {
            if (t.id === arg.id) {
              return {
                ...t,
                totalProgress: arg.totalProgress,
                totalTimePause: arg.totalTimePause,
                currentTimePause: arg.currentTimePause,
                active: arg.active,
                checkpoints: arg.checkpoints || t.checkpoints || []
              };
            }
            return t;
          });
          localStorage.setItem('tarefas', JSON.stringify(updated));
          return updated;
        });
      });

      ioInstance.on('exit', () => {
        setOffline(true);
        setTimeout(() => window.location.reload(), 3000);
      });
    }

    // Load from local storage
    const saved = localStorage.getItem('tarefas');
    const savedHours = localStorage.getItem('meta_horas');
    const savedStart = localStorage.getItem('workday_start');
    const savedEnd = localStorage.getItem('workday_end');
    const savedBreak = localStorage.getItem('workday_break');

    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        setTasks([]);
      }
    }
    if (savedStart) setWorkdayStart(savedStart);
    if (savedEnd) setWorkdayEnd(savedEnd);
    if (savedBreak !== null && savedBreak !== undefined) setLunchBreak(parseFloat(savedBreak) || 0);

    if (savedHours) {
      setDayTotalHours(parseFloat(savedHours) || 8);
    } else if (savedStart && savedEnd) {
      const computed = computeWorkdayHours(savedStart, savedEnd, parseFloat(savedBreak) || 0);
      setDayTotalHours(computed);
    }

    return () => {
      if (ioInstance) {
        ioInstance.off('sync-store');
        ioInstance.off('update');
        ioInstance.off('exit');
      }
    };
  }, []);

  useEffect(() => {
    if (editingTaskId && !tasks.some(t => t.id === editingTaskId)) {
      setEditingTaskId(null);
      setEditingTitleText('');
    }
  }, [tasks, editingTaskId]);

  // Sync to local storage
  const saveTasks = (newTasks) => {
    setTasks(newTasks);
    localStorage.setItem('tarefas', JSON.stringify(newTasks));
    if (socket) {
      socket.emit('save-store', { tasks: newTasks, dayTotalHours });
    }
  };

  const handleUpdateDayHours = (hours) => {
    setDayTotalHours(hours);
    localStorage.setItem('meta_horas', hours.toString());
    if (socket) {
      socket.emit('save-store', { tasks, dayTotalHours: hours });
    }
  };

  const handleWorkdayChange = (newStart, newEnd, newBreak) => {
    setWorkdayStart(newStart);
    setWorkdayEnd(newEnd);
    setLunchBreak(newBreak);

    localStorage.setItem('workday_start', newStart);
    localStorage.setItem('workday_end', newEnd);
    localStorage.setItem('workday_break', newBreak.toString());

    const computedHours = computeWorkdayHours(newStart, newEnd, newBreak);
    handleUpdateDayHours(computedHours);
  };

  // Calculations according to the new remaining time sharing rules
  const totalPausasHoras = tasks.reduce((sum, t) => sum + (t.totalTimePause || 0), 0) / 3600;
  const progressoLivres = tasks
    .filter((t) => t.flexible)
    .reduce((sum, t) => sum + (t.totalProgress || 0), 0) / 3600;

  const tempoComprometidoFixas = tasks
    .filter((t) => !t.flexible)
    .reduce((sum, t) => {
      const duration = parseFloat(t.totalTimeFloat || 0);
      const progress = (t.totalProgress || 0) / 3600;
      return sum + Math.max(duration, progress);
    }, 0);

  const tempoRestante = Math.max(0, dayTotalHours - tempoComprometidoFixas - progressoLivres - totalPausasHoras);

  // Recalculate flexible tasks durations dynamically (each gets full remaining time minus progress of other flexible tasks and all global pauses)
  const computedTasks = tasks.map((t) => {
    if (t.flexible) {
      const selfSpentHoursReal = ((t.totalProgress || 0) + (t.totalTimePause || 0)) / 3600;
      const tMaxDuration = tempoRestante + selfSpentHoursReal;
      return {
        ...t,
        totalTimeFloat: tMaxDuration,
        totalTimeSeconds: convertFloatToSeconds(tMaxDuration)
      };
    }
    return t;
  });

  // Check if there is already a flexible task in the list
  const hasFlexibleTask = tasks.some((t) => t.flexible);

  // Total alocado global (comprometido das fixas + progresso real das livres + pausas de todas as tarefas)
  const totalAlocado = tempoComprometidoFixas + progressoLivres + totalPausasHoras;
  const totalPauseSeconds = computedTasks.reduce((sum, t) => sum + (t.totalTimePause || 0), 0);
  const totalUsedSeconds = computedTasks.reduce((sum, t) => sum + (t.totalProgress || 0), 0);
  const totalTimeSeconds = convertFloatToSeconds(totalAlocado);

  // Handlers for controls
  const handleAddTask = () => {
    const duration = !isFixed ? tempoRestante : parseFloat(taskDuration);
    
    if (duration <= 0 && isFixed) return;


    const newTaskObj = {
      id: Date.now().toString(16),
      title: taskTitle.trim() || `Tarefa #${tasks.length + 1}`,
      totalTimeFloat: duration,
      totalTimeSeconds: convertFloatToSeconds(duration),
      totalProgress: 0,
      totalTimePause: 0,
      active: false,
      flexible: !isFixed,
      checkpoints: []
    };

    const newTasks = [...tasks, newTaskObj];
    saveTasks(newTasks);

    // Reset inputs
    setTaskTitle('');
    setTaskDuration(0);
  };

  const handleRemoveTask = (taskId) => {
    const toRemove = tasks.find(t => t.id === taskId);
    const newTasks = tasks.filter(t => t.id !== taskId);
    saveTasks(newTasks);
    
    if (toRemove && toRemove.active && socket) {
      socket.emit('stop', {});
    }
  };

  const handleStartEdit = (id, currentTitle) => {
    setEditingTaskId(id);
    setEditingTitleText(currentTitle);
  };

  const handleSaveEdit = (id) => {
    if (!editingTitleText.trim()) {
      handleCancelEdit();
      return;
    }
    const updatedTasks = tasks.map(t => {
      if (t.id === id) {
        return { ...t, title: editingTitleText.trim() };
      }
      return t;
    });
    saveTasks(updatedTasks);

    const editedTask = updatedTasks.find(t => t.id === id);
    if (editedTask && editedTask.active && socket) {
      const computedTasksList = computedTasks.map(t => {
        if (t.id === id) {
          return { ...t, title: editingTitleText.trim() };
        }
        return t;
      });
      const activeIdx = computedTasksList.findIndex(t => t.id === id);
      if (activeIdx !== -1) {
        socket.emit('evento', computedTasksList[activeIdx]);
      }
    }
    
    setEditingTaskId(null);
    setEditingTitleText('');
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTitleText('');
  };

  const handleSetActive = (taskId) => {
    const targetTask = computedTasks.find(t => t.id === taskId);
    if (!targetTask) return;

    setTasks(prevTasks => {
      const updated = prevTasks.map(t => ({
        ...t,
        active: t.id === targetTask.id
      }));
      localStorage.setItem('tarefas', JSON.stringify(updated));
      return updated;
    });

    const activeTargetTask = {
      ...targetTask,
      active: true
    };

    if (socket) {
      socket.emit('evento', activeTargetTask);
    }
  };



  const handleStopAll = () => {
    const updated = tasks.map((t) => ({ ...t, active: false }));
    saveTasks(updated);
    if (socket) {
      socket.emit('stop', {});
    }
  };

  const handleClearAll = () => {
    showModal('danger', 'Limpar Atividades', 'Deseja remover todos os itens da lista? Esta ação não pode ser desfeita.', () => {
      if (socket) {
        socket.emit('stop', {});
      }
      saveTasks([]);
      localStorage.removeItem('tarefas');
      closeModal();
    });
  };

  const handleExitApp = () => {
    showModal('danger', 'Encerrar Aplicativo', 'Deseja encerrar o WorkTimeBar e fechar a janela flutuante?', () => {
      if (socket) {
        socket.emit('exit', {});
      }
      if (window.electronAPI) {
        window.electronAPI.send('exit', {});
      }
      closeModal();
    });
  };

  const handleDeleteCheckpoint = (taskId, checkpointId) => {
    if (socket) {
      socket.emit('delete-checkpoint', { taskId, checkpointId });
    }
  };

  const handleExport = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("download", `worktimebar-tasks-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      showModal('error', 'Erro na Exportação', 'Não foi possível exportar as atividades: ' + error.message);
    }
  };

  const handleImport = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        
        if (!Array.isArray(parsed)) {
          showModal('error', 'Formato Inválido', 'O arquivo precisa conter uma lista de atividades em formato JSON válido.');
          return;
        }

        const isValid = parsed.every(item => item && typeof item === 'object' && 'id' in item && 'title' in item);
        if (!isValid) {
          showModal('error', 'Arquivo Corrompido', 'Algumas atividades não possuem os campos obrigatórios (id, title).');
          return;
        }

        // Stop current active task first
        if (socket) {
          socket.emit('stop', {});
        }

        saveTasks(parsed);

        // Sync to electron if any imported task is active
        const activeIndex = parsed.findIndex(t => t.active);
        if (activeIndex !== -1 && socket) {
          // React state is asynchronous, we emit the task from parsed array
          // Since computedTasks updates dynamically, we build the task structure here
          const activeTask = parsed[activeIndex];
          
          // Re-calculate the actual duration float/seconds to be safe
          let finalTask = { ...activeTask };
          if (activeTask.flexible) {
            // For flexible tasks, we recompute duration on fly
            const selfSpentHoursReal = ((activeTask.totalProgress || 0) + (activeTask.totalTimePause || 0)) / 3600;
            
            // Recalculate tempoRestante with the parsed array
            const totalPausas = parsed.reduce((sum, t) => sum + (t.totalTimePause || 0), 0) / 3600;
            const progressoL = parsed.filter(t => t.flexible).reduce((sum, t) => sum + (t.totalProgress || 0), 0) / 3600;
            const tempoComprometido = parsed.filter(t => !t.flexible).reduce((sum, t) => {
              const d = parseFloat(t.totalTimeFloat || 0);
              const p = (t.totalProgress || 0) / 3600;
              return sum + Math.max(d, p);
            }, 0);
            const remaining = Math.max(0, dayTotalHours - tempoComprometido - progressoL - totalPausas);
            
            const tMaxDuration = remaining + selfSpentHoursReal;
            finalTask.totalTimeFloat = tMaxDuration;
            finalTask.totalTimeSeconds = convertFloatToSeconds(tMaxDuration);
          }
          
          socket.emit('evento', finalTask);
        }

        showModal('success', 'Importação Concluída', `${parsed.length} atividade${parsed.length > 1 ? 's' : ''} importada${parsed.length > 1 ? 's' : ''} com sucesso!`);
      } catch (error) {
        showModal('error', 'Erro na Importação', 'Não foi possível ler o arquivo JSON: ' + error.message);
      }
    };
    fileReader.readAsText(file);
    e.target.value = '';
  };

  const percentAlocado = dayTotalHours > 0 ? Math.min(100, Math.round((totalAlocado * 100) / dayTotalHours)) : 0;
  const percentUsed = totalTimeSeconds > 0 ? Math.min(100, Math.round((totalUsedSeconds * 100) / totalTimeSeconds)) : 0;
  const percentPause = totalTimeSeconds > 0 ? Math.min(100, Math.round((totalPauseSeconds * 100) / totalTimeSeconds)) : 0;

  return (
    <div className="min-h-screen bg-black font-sans text-neutral-200 antialiased relative overflow-hidden pb-20 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Mesh Background Gradients inspired by ForgeUI landing */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[25%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px]"></div>
        <div className="absolute top-[20%] right-[20%] w-[450px] h-[450px] rounded-full bg-violet-500/5 blur-[100px]"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-[95.8rem] px-4 md:px-8 lg:px-12 pt-6 space-y-16">
        
        {/* Navigation / Header */}
        <nav className="w-full flex items-center justify-between border-b border-neutral-900 pb-5">
          <div className="flex items-center space-x-3">
            <img src={faviconImg} alt="Logo" className="h-7 w-7 rounded-full border border-neutral-800 shadow-[0_0_10px_rgba(6,182,212,0.15)]" />
            <span className="text-lg font-bold text-white tracking-tight">WorkTimeBar</span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-semibold backdrop-blur-md transition-all ${
              offline 
                ? 'bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]' 
                : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${offline ? 'bg-red-500 animate-pulse' : 'bg-cyan-500 animate-pulse'}`}></span>
              {offline ? 'Off-line' : 'Contador Ativo'}
            </div>

            <button
              onClick={handleExitApp}
              type="button"
              title="Encerrar Aplicativo"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[11px] font-semibold transition-all shadow-[0_0_12px_rgba(239,68,68,0.15)] cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
              <span>Fechar App</span>
            </button>
          </div>
        </nav>

        {/* Hero Section - Identical style to ForgeUI Homepage */}
        <section className="text-center max-w-4xl mx-auto flex flex-col items-center justify-center gap-5 pt-8">
          <h1 className="bg-gradient-to-br from-neutral-100 via-neutral-100 via-50% to-neutral-100/30 bg-clip-text py-2 text-4xl leading-[1.1] font-semibold tracking-tighter text-balance text-transparent md:text-5xl lg:text-6xl">
            Foco em clareza/produtividade:
          </h1>
          <p className="max-w-2xl bg-gradient-to-br from-white/70 via-white/70 to-white/30 bg-clip-text text-center text-sm text-balance text-transparent md:text-base lg:text-lg leading-relaxed">
Seu Tempo, Sob Controle
Acompanhe suas atividades em tempo real, defina limites e mantenha o foco — tudo em um visor flutuante, leve e sempre à mão.
          </p>
        </section>

        {/* KPIs Section - Redesigned based on ForgeUI Home Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Alocação (Smart Access / Code Background Mesh Style) */}
          <div className="relative overflow-hidden h-[180px] rounded-2xl border border-neutral-900 bg-neutral-950/70 p-6 flex flex-col justify-between group">
            {/* Blurry Code Overlay */}
            <div className="absolute top-4 left-4 right-4 font-mono text-[9px] text-neutral-700 opacity-25 select-none pointer-events-none break-all leading-3">
              {"CONST TOTAL_DAY_LIMIT = "}{dayTotalHours}{"H; // PROCESS ALOCACAO TIMETABLE"}<br />
              {"LET TASKS = ["}{tasks.map(t => `'${t.title}'`).join(', ')}{"];"}<br />
              {"TASK_LIST.MAP(T => T.ACTIVE && EMIT_STATUS(T));"}<br />
              {"IF (TOTAL_HOURS > LIMIT) BLOCK_NEW_ENTRIES();"}
            </div>
            
            <div className="absolute top-0 right-0 h-24 w-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors"></div>
            
            <div className="relative z-10 space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Alocação Total</h3>
              <p className="text-[10px] text-neutral-600">Soma de todas as atividades do dia</p>
            </div>
            <div className="relative z-10 flex items-baseline justify-between mt-auto">
              <span className="text-3xl font-extrabold font-mono text-cyan-400">{percentAlocado}%</span>
              <span className="text-xs text-neutral-400 font-mono">{totalAlocado.toFixed(1)}h / {dayTotalHours}h</span>
            </div>
          </div>

          {/* Card 2: Pausas (Bot Detection / Dashed Radar Orbits Style) */}
          <div className="relative overflow-hidden h-[180px] rounded-2xl border border-neutral-900 bg-neutral-950/70 p-6 flex flex-col justify-between group">
            {/* Dashed Radar Orbits */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border border-dashed border-neutral-800/80 pointer-events-none select-none"></div>
            <div className="absolute -right-12 -bottom-12 w-32 h-32 rounded-full border border-dashed border-neutral-800/40 pointer-events-none select-none"></div>
            {/* Pulsing Red Dot inside orbits */}
            {totalPauseSeconds > 0 && (
              <div className="absolute right-12 bottom-12 flex h-2 w-2 items-center justify-center rounded-full bg-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.9)] animate-ping"></div>
            )}
            
            <div className="relative z-10 space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Pausas Ativas</h3>
              <p className="text-[10px] text-neutral-600">Tempo acumulado fora de foco</p>
            </div>
            <div className="relative z-10 flex items-baseline justify-between mt-auto">
              <span className="text-3xl font-extrabold font-mono text-red-400">
                {percentPause}%
              </span>
              <span className="text-xs text-neutral-400 font-mono">{convertSecondsToHour(totalPauseSeconds)}</span>
            </div>
          </div>

          {/* Card 3: Aproveitamento (Secure Access / OTP Digits Style) */}
          <div className="relative overflow-hidden h-[180px] rounded-2xl border border-neutral-900 bg-neutral-950/70 p-6 flex flex-col justify-between group">
            <div className="absolute top-0 right-0 h-24 w-24 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors"></div>
            
            <div className="relative z-10 space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Aproveitamento</h3>
              <p className="text-[10px] text-neutral-600">Progresso total executado</p>
            </div>
            
            {/* OTP Style Digital Block Representing Progress */}
            <div className="flex gap-1.5 my-2">
              {String(percentUsed).padStart(3, '0').split('').map((char, index) => (
                <div key={index} className="relative flex h-10 w-8 items-center justify-center rounded-lg bg-neutral-900/60 border border-neutral-850 text-cyan-400 font-mono font-bold text-lg shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]">
                  {char}
                </div>
              ))}
              <div className="flex h-10 w-8 items-center justify-center text-neutral-600 font-bold text-lg">%</div>
            </div>

            <div className="relative z-10 flex items-baseline justify-between mt-auto">
              <span className="text-xs text-neutral-500 font-mono">Foco produtivo</span>
              <span className="text-xs text-neutral-400 font-mono">{convertSecondsToHour(totalUsedSeconds)}</span>
            </div>
          </div>

        </section>

        {/* Dashboard Grid Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Card Esquerdo: Configuração & Cadastro (1/3 da tela) */}
          <div className="bg-neutral-950/50 p-6 rounded-2xl border border-neutral-900 shadow-xl backdrop-blur-sm space-y-6">
            <h2 className="text-base font-bold text-neutral-200 tracking-tight">Nova Atividade</h2>

            <div className="space-y-4">
              {/* Cronograma de Jornada Module */}
              <div className="p-4 rounded-xl border border-neutral-900 bg-neutral-950/60 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-neutral-200 tracking-tight">Cronograma de Jornada</h3>
                      <p className="text-[10px] text-neutral-500">Início, término e pausa de almoço</p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xs font-extrabold text-cyan-400">{dayTotalHours}h</span>
                    <span className="text-[9px] text-neutral-500 block uppercase tracking-wider">Úteis</span>
                  </div>
                </div>

                {/* Inputs Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Início */}
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      🟢 Entrada
                    </label>
                    <input
                      type="time"
                      value={workdayStart}
                      onChange={(e) => handleWorkdayChange(e.target.value, workdayEnd, lunchBreak)}
                      className="w-full rounded-lg border border-neutral-900 bg-neutral-950 text-neutral-100 p-2 text-xs font-semibold font-mono outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Término */}
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      🔴 Saída
                    </label>
                    <input
                      type="time"
                      value={workdayEnd}
                      onChange={(e) => handleWorkdayChange(workdayStart, e.target.value, lunchBreak)}
                      className="w-full rounded-lg border border-neutral-900 bg-neutral-950 text-neutral-100 p-2 text-xs font-semibold font-mono outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Pausa / Almoço */}
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      🟡 Almoço
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="4"
                        value={lunchBreak}
                        onChange={(e) => handleWorkdayChange(workdayStart, workdayEnd, Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full rounded-lg border border-neutral-900 bg-neutral-950 text-neutral-100 p-2 text-xs font-semibold font-mono outline-none focus:border-cyan-500"
                      />
                      <span className="absolute right-2 text-[9px] font-bold text-neutral-600 uppercase">h</span>
                    </div>
                  </div>
                </div>

                {/* Timeline Visual Graphic */}
                <div className="pt-2.5 border-t border-neutral-900/60 space-y-2">
                  <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400">
                    <span className="text-emerald-400 font-semibold">{workdayStart}</span>
                    <span className="text-amber-400 font-semibold">Pausa ({lunchBreak}h)</span>
                    <span className="text-red-400 font-semibold">{workdayEnd}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-neutral-900 p-0.5 flex gap-0.5 overflow-hidden border border-neutral-900">
                    <div className="h-full rounded-l-full bg-cyan-500/80 shadow-[0_0_8px_rgba(6,182,212,0.4)] flex-1" title="Turno 1 (Manhã)"></div>
                    <div className="h-full bg-amber-500/80 w-1/5 shrink-0" title={`Almoço (${lunchBreak}h)`}></div>
                    <div className="h-full rounded-r-full bg-sky-500/80 shadow-[0_0_8px_rgba(14,165,233,0.4)] flex-1" title="Turno 2 (Tarde)"></div>
                  </div>
                </div>
              </div>

              {/* Título da atividade */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Título
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex: Code Refactoring"
                  className="w-full rounded-xl border border-neutral-900 bg-neutral-950/80 text-neutral-100 placeholder-neutral-700 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200 p-3 text-sm font-semibold"
                />
              </div>

              {/* Slider & Tempo Livre Options */}
              <div className="p-4 rounded-xl border border-neutral-900 bg-neutral-950/40 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-300">Alocar tempo Fixo</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    {isFixed 
                      ? "Define uma duração fixa para esta atividade." 
                      : `Preencher automaticamente com as ${convertFloatToHours(tempoRestante)} livres.`}
                  </p>
                </div>
                {/* Switch estilo ForgeUI */}
                <button
                  type="button"
                  onClick={() => setIsFixed(!isFixed)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isFixed ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-neutral-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isFixed ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isFixed && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Duração
                    </label>
                    <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-0.5 text-xs font-bold text-cyan-400 font-mono">
                      {convertFloatToHours(taskDuration)}
                    </span>
                  </div>
                  <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-900 space-y-3">
                    <input
                      type="range"
                      value={taskDuration}
                      min="0"
                      max={tempoRestante}
                      step="0.1"
                      onChange={(e) => setTaskDuration(parseFloat(e.target.value))}
                      className="w-full h-1 cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-cyan-500 focus:outline-none"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-600 font-mono">
                      <span>0.0h</span>
                      <span>Máximo: {tempoRestante.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão de Cadastro - Estilo botão principal do ForgeUI (branco sólido com hover vibrante) */}
              <button
                type="button"
                onClick={handleAddTask}
                disabled={(taskDuration <= 0 && isFixed) || (!isFixed && tempoRestante <= 0)}
                className="w-full rounded-xl bg-white hover:bg-neutral-100 text-black disabled:bg-neutral-900 disabled:text-neutral-600 disabled:border disabled:border-neutral-850 py-3 text-xs font-bold transition-all duration-200 shadow-md flex items-center justify-center gap-2 transform active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Criar Atividade
              </button>
            </div>
          </div>

          {/* Card Direito: Lista de Atividades (2/3 da tela - Stripe notifications style) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-900 pb-4">
              <h2 className="text-base font-bold text-neutral-200 tracking-tight">Atividades</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  title="Exportar atividades para um arquivo JSON"
                  className="border border-neutral-900 bg-neutral-950/60 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Exportar
                </button>
                <label 
                  title="Importar atividades a partir de um arquivo JSON"
                  className="cursor-pointer border border-neutral-900 bg-neutral-950/60 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm flex items-center"
                >
                  <svg className="w-3.5 h-3.5 me-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Importar
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handleClearAll}
                  className="border border-neutral-900 bg-neutral-950/60 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  Limpar
                </button>
                <button
                  onClick={handleStopAll}
                  className="border border-neutral-900 bg-neutral-950/60 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  Parar Tudo
                </button>
              </div>
            </div>

            {/* List of Stripe Payment style notifications */}
            <div className="space-y-3">
              {computedTasks.map((task) => {
                const percentTaskAlocado = dayTotalHours > 0 ? (task.totalTimeFloat * 100) / dayTotalHours : 0;
                return (
                  <div 
                    key={task.id}
                    onClick={() => handleSetActive(task.id)}
                    className={`group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md ${
                      task.active 
                        ? 'border-cyan-500/40 bg-neutral-950 shadow-[0_0_15px_rgba(6,182,212,0.06)]' 
                        : 'border-neutral-900 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/30'
                    }`}
                  >
                    {/* Active Accent left line */}
                    {task.active && (
                      <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-cyan-500 shadow-[2px_0_10px_rgba(6,182,212,0.8)]"></div>
                    )}

                    {/* Logo/Icon + Title block */}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      {/* Icon with integrated radio-style selection indicator */}
                      <div className="relative shrink-0">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-md transition-all duration-300 ${
                          task.active
                            ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 scale-110'
                            : 'bg-neutral-900/60 border-neutral-850 text-neutral-500 group-hover:border-neutral-700 group-hover:text-neutral-300'
                        }`}>
                          {task.flexible ? (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 9H3m14.071 7.071l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        {/* Selection radio dot */}
                        <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-neutral-950 transition-all duration-300 ${
                          task.active 
                            ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]' 
                            : 'bg-neutral-800 group-hover:bg-neutral-600'
                        }`}>
                          {task.active && (
                            <svg className="h-full w-full text-neutral-950 p-[1px]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Title block */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {editingTaskId === task.id ? (
                            <input
                              type="text"
                              value={editingTitleText}
                              onChange={(e) => setEditingTitleText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit(task.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              onBlur={() => handleSaveEdit(task.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 px-2 py-0.5 text-sm font-semibold outline-none focus:border-cyan-500 w-full max-w-[200px]"
                              autoFocus
                            />
                          ) : (
                            <p className="truncate text-sm font-semibold text-neutral-100">{task.title}</p>
                          )}
                          {task.flexible && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider shrink-0">
                              Livre
                            </span>
                          )}
                          {task.checkpoints && task.checkpoints.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider shrink-0">
                              🚩 {task.checkpoints.length} {task.checkpoints.length === 1 ? 'sessão' : 'retornos'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">Alocado: {!task.flexible ? `${task.totalTimeFloat.toFixed(1)}h` : 'Variável'}</p>
                      </div>
                    </div>

                    {/* Progress Bar & Timers block */}
                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                      
                      {/* Dynamic timer display */}
                      <div className="font-mono text-xs text-neutral-300 shrink-0">
                        <span className="text-cyan-400 font-bold">{convertSecondsToHour(task.totalProgress || 0)}</span>
                        <span className="text-neutral-700 mx-1">/</span>
                        <span className="text-neutral-500">{convertSecondsToHour(task.totalTimeSeconds - (task.totalTimePause || 0))}</span>
                      </div>

                      {/* Compact Progress Bar */}
                      <div className="w-16 bg-neutral-900 h-1 rounded-full overflow-hidden shrink-0 hidden sm:block">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            task.active 
                              ? 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]' 
                              : 'bg-neutral-700'
                          }`}
                          style={{ width: `${Math.min(100, percentTaskAlocado)}%` }}
                        ></div>
                      </div>

                      {/* Delete & Edit Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCheckpointModalTask(task);
                          }}
                          title="Ver histórico de checkpoints e retornos"
                          className="p-2 rounded-lg border border-neutral-900 bg-neutral-950/60 text-neutral-600 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(task.id, task.title);
                          }}
                          title="Editar título da atividade"
                          className="p-2 rounded-lg border border-neutral-900 bg-neutral-950/60 text-neutral-600 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveTask(task.id); }}
                          title="Excluir atividade"
                          className="p-2 rounded-lg border border-neutral-900 bg-neutral-950/60 text-neutral-600 hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}

              {computedTasks.length === 0 && (
                <div className="border border-dashed border-neutral-900 rounded-xl py-12 text-center bg-neutral-950/20">
                  <svg className="mx-auto h-8 w-8 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <p className="mt-3 text-xs text-neutral-500 font-medium">Nenhuma atividade cadastrada ainda.</p>
                  <p className="mt-1 text-[10px] text-neutral-600">Adicione uma atividade na barra lateral.</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
      {/* Custom Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"></div>
          
          {/* Modal Card */}
          <div 
            className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-[scaleIn_200ms_ease-out] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${
              modal.type === 'danger' ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_1px_8px_rgba(239,68,68,0.6)]' :
              modal.type === 'error' ? 'bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_1px_8px_rgba(245,158,11,0.6)]' :
              modal.type === 'success' ? 'bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_1px_8px_rgba(16,185,129,0.6)]' :
              'bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_1px_8px_rgba(6,182,212,0.6)]'
            }`}></div>

            <div className="p-6 space-y-5">
              {/* Icon */}
              <div className="flex justify-center">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg ${
                  modal.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  modal.type === 'error' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  modal.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                }`}>
                  {modal.type === 'danger' && (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  )}
                  {modal.type === 'error' && (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  )}
                  {modal.type === 'success' && (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  )}
                  {modal.type === 'info' && (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Text */}
              <div className="text-center space-y-2">
                <h3 className="text-sm font-bold text-neutral-100 tracking-tight">{modal.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{modal.message}</p>
              </div>

              {/* Actions */}
              <div className={`flex gap-3 ${modal.onConfirm ? 'justify-center' : 'justify-center'}`}>
                {modal.onConfirm ? (
                  <>
                    <button
                      onClick={closeModal}
                      className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={modal.onConfirm}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 shadow-md active:scale-[0.98] ${
                        modal.type === 'danger'
                          ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
                          : 'bg-white hover:bg-neutral-100 text-black'
                      }`}
                    >
                      Confirmar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={closeModal}
                    className="w-full max-w-[200px] rounded-xl bg-white hover:bg-neutral-100 text-black py-2.5 text-xs font-bold transition-all duration-200 shadow-md active:scale-[0.98]"
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Checkpoint / Sessions Modal */}
      {checkpointModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCheckpointModalTask(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"></div>
          <div 
            className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.8)] animate-[scaleIn_200ms_ease-out] overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_1px_8px_rgba(6,182,212,0.6)]"></div>
            <div className="p-6 pb-4 border-b border-neutral-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-100 truncate max-w-[280px]">
                    {checkpointModalTask.title}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Histórico de Retornos e Sessões ({checkpointModalTask.checkpoints ? checkpointModalTask.checkpoints.length : 0})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setCheckpointModalTask(null)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 font-sans">
              {(!checkpointModalTask.checkpoints || checkpointModalTask.checkpoints.length === 0) ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  Nenhum checkpoint registrado ainda para esta atividade.
                </div>
              ) : (
                checkpointModalTask.checkpoints.map((cp, i) => {
                  const startFormatted = cp.startTime ? new Date(cp.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';
                  const endFormatted = cp.endTime ? new Date(cp.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Em andamento...';
                  const dateFormatted = cp.startTime ? new Date(cp.startTime).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : '';
                  const isCurrent = cp.endTime === null;

                  return (
                    <div key={cp.id || i} className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      isCurrent 
                        ? 'border-cyan-500/30 bg-cyan-500/5 shadow-[0_0_10px_rgba(6,182,212,0.05)]' 
                        : 'border-neutral-900 bg-neutral-900/40 hover:border-neutral-800'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold font-mono ${
                          isCurrent ? 'bg-cyan-500 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          #{i + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-neutral-200 flex items-center gap-2">
                            <span>{dateFormatted} {startFormatted} — {endFormatted}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 text-[8px] rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase tracking-wider animate-pulse">
                                Ativa
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                            Progresso: {convertSecondsToHour(cp.progressStart || 0)} ➔ {convertSecondsToHour(cp.progressEnd || 0)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-mono font-bold text-cyan-400 text-sm">
                            {convertSecondsToHour(cp.duration || 0)}
                          </span>
                          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">
                            Decorridos
                          </div>
                        </div>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCheckpoint(checkpointModalTask.id, cp.id)}
                            title="Excluir e mesclar com a próxima sessão"
                            className="p-1.5 rounded-lg border border-neutral-900 bg-neutral-950/60 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-neutral-900 bg-neutral-950/80 flex justify-end">
              <button
                onClick={() => setCheckpointModalTask(null)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
