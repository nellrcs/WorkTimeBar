import React, { useState, useEffect, useRef } from 'react';
import faviconImg from '../../favicon.ico';

// Helper function to format seconds to HH:MM:SSh
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

function barPercentage(value, max) {
  if (!max) return 0;
  let bar = Math.round((100 * value) / max);
  if (bar <= 100) return bar;
  return 100;
}

export default function FloatingWindow() {
  const [isOn, setIsOn] = useState(false);
  const [serverMsg, setServerMsg] = useState('...');
  const [activity, setActivity] = useState(null);
  
  // Timers and operational states
  const [totalProgress, setTotalProgress] = useState(0);
  const [currentTimePause, setCurrentTimePause] = useState(0);
  const [totalTimePause, setTotalTimePause] = useState(0);
  const [active, setActive] = useState(false); // Play status
  
  const playTimerRef = useRef(null);
  const pauseTimerRef = useRef(null);
  
  // Persistent refs for timestamps and backing up values to avoid closure issues in intervals
  const activityRef = useRef(null);
  activityRef.current = activity;

  const activeRef = useRef(active);
  activeRef.current = active;

  const totalProgressRef = useRef(totalProgress);
  totalProgressRef.current = totalProgress;

  const totalTimePauseRef = useRef(totalTimePause);
  totalTimePauseRef.current = totalTimePause;

  const stateRef = useRef({
    playStartTime: 0,
    pauseStartTime: 0,
    basePauseProgress: 0
  });

  // Connect socket.io
  useEffect(() => {
    // 1. Listen for instructions from the control panel
    const removeInstructions = window.electronAPI.on('instructions', (arg) => {
      setIsOn(true);
      
      // Clean up previous active timers to avoid overlapping loops
      clearInterval(playTimerRef.current);
      clearInterval(pauseTimerRef.current);
      playTimerRef.current = null;
      pauseTimerRef.current = null;

      const initProgress = arg.totalProgress || 0;
      const initTimePause = arg.totalTimePause || 0;
      setActivity(arg);
      setTotalProgress(initProgress);
      setTotalTimePause(initTimePause);
      setCurrentTimePause(arg.currentTimePause || 0);
      setActive(arg.active || false);

      // Reactively trigger play/pause timers based on active parameter
      if (arg.active) {
        const totalSec = arg.totalTimeSeconds;
        stateRef.current.playStartTime = Date.now() - (initProgress * 1000);

        playTimerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - stateRef.current.playStartTime) / 1000);
          const currProgress = Math.min(elapsed, totalSec);
          
          if (currProgress >= totalSec) {
            setTotalProgress(totalSec);
            clearInterval(playTimerRef.current);
            playTimerRef.current = null;
            setActive(false);
            
            // Dispatch completion notification
            window.electronAPI.send('finish', {
              ...arg,
              totalProgress: totalSec,
              totalTimePause: totalTimePauseRef.current,
              active: false
            });
          } else {
            setTotalProgress(currProgress);
            window.electronAPI.send('status', {
              ...arg,
              totalProgress: currProgress,
              totalTimePause: totalTimePauseRef.current,
              active: true
            });
          }
        }, 1000);
      } else {
        // Pause timer to count inactive time
        stateRef.current.pauseStartTime = Date.now();
        stateRef.current.basePauseProgress = initTimePause;

        // Only track pause if the task is not completed yet
        if (initProgress < arg.totalTimeSeconds) {
          pauseTimerRef.current = setInterval(() => {
            const elapsedPause = Math.floor((Date.now() - stateRef.current.pauseStartTime) / 1000);
            const nextPauseVal = stateRef.current.basePauseProgress + elapsedPause;
            setTotalTimePause(nextPauseVal);
            setCurrentTimePause(elapsedPause);

            window.electronAPI.send('status', {
              ...arg,
              totalProgress: totalProgressRef.current,
              totalTimePause: nextPauseVal,
              currentTimePause: elapsedPause,
              active: false
            });
          }, 1000);
        }
      }
    });

    // 2. Listen for stop
    const removeStop = window.electronAPI.on('stop', () => {
      setIsOn(false);
      setActivity(null);
      setActive(false);
      clearInterval(playTimerRef.current);
      clearInterval(pauseTimerRef.current);
      playTimerRef.current = null;
      pauseTimerRef.current = null;
    });

    // 3. Listen for server messages
    const removeServer = window.electronAPI.on('server', (msg) => {
      setServerMsg(msg);
    });

    // Signal online
    window.electronAPI.send('online', '1');

    return () => {
      removeInstructions();
      removeStop();
      removeServer();
      clearInterval(playTimerRef.current);
      clearInterval(pauseTimerRef.current);
    };
  }, []);

  const handleControlClick = () => {
    if (!activityRef.current) return;

    const nextActiveState = !activeRef.current;
    setActive(nextActiveState);

    if (nextActiveState) {
      // Play clicked: clear pause timer
      clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
      setCurrentTimePause(0);

      const backupProg = totalProgressRef.current;
      const totalSec = activityRef.current.totalTimeSeconds;
      stateRef.current.playStartTime = Date.now() - (backupProg * 1000);

      playTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - stateRef.current.playStartTime) / 1000);
        const currProgress = Math.min(elapsed, totalSec);
        
        if (currProgress >= totalSec) {
          setTotalProgress(totalSec);
          clearInterval(playTimerRef.current);
          playTimerRef.current = null;
          setActive(false);

          window.electronAPI.send('finish', {
            ...activityRef.current,
            totalProgress: totalSec,
            totalTimePause: totalTimePauseRef.current,
            active: false
          });
        } else {
          setTotalProgress(currProgress);
          window.electronAPI.send('status', {
            ...activityRef.current,
            totalProgress: currProgress,
            totalTimePause: totalTimePauseRef.current,
            active: true
          });
        }
      }, 1000);

    } else {
      // Pause clicked: clear play timer and start pause timer
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      
      const totalSec = activityRef.current.totalTimeSeconds;
      const currentProg = totalProgressRef.current;
      const initTimePause = totalTimePauseRef.current;

      stateRef.current.pauseStartTime = Date.now();
      stateRef.current.basePauseProgress = initTimePause;

      // Only track pause if the task is not completed yet
      if (currentProg < totalSec) {
        pauseTimerRef.current = setInterval(() => {
          const elapsedPause = Math.floor((Date.now() - stateRef.current.pauseStartTime) / 1000);
          const nextPauseVal = stateRef.current.basePauseProgress + elapsedPause;
          setTotalTimePause(nextPauseVal);
          setCurrentTimePause(elapsedPause);

          window.electronAPI.send('status', {
            ...activityRef.current,
            totalProgress: currentProg,
            totalTimePause: nextPauseVal,
            currentTimePause: elapsedPause,
            active: false
          });
        }, 1000);
      }
    }
  };

  const handleNext = () => window.electronAPI.send('next', {});
  const handleBack = () => window.electronAPI.send('back', {});
  const handleCheckpoint = () => window.electronAPI.send('checkpoint', {});

  const percent = activity ? barPercentage(totalProgress, activity.totalTimeSeconds) : 0;
  const isFinished = activity && totalProgress >= activity.totalTimeSeconds;

  return (
    <div className="min-h-screen rounded-2xl border border-neutral-900 bg-neutral-950/90 backdrop-blur-xl font-sans p-2.5 shadow-[0_0_30px_rgba(0,0,0,0.85)] relative overflow-hidden transition-all duration-300 select-none">
      {/* Background neon ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[3px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent blur-[1px] z-10 animate-soft-bounce pointer-events-none"></div>
      
      {isOn && activity ? (
        <div id="on" className="h-full flex flex-col justify-center">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="min-w-0 flex-1 pl-2">
              
              {/* Activity title & Badge */}
              <div className="mb-2 min-w-0 flex-1 text-xs font-semibold text-neutral-100 drag tracking-tight flex items-center">
                <p id="activityTitle" className="truncate flex-1">
                  {activity.title}
                </p>
                {activity.flexible && (
                  <span className="text-[8px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 ml-1.5 font-bold uppercase tracking-wider shrink-0">
                    Livre
                  </span>
                )}
              </div>

              {/* High-tech Progress bar container */}
              <div className="drag mb-2.5 h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden border border-neutral-900">
                <div
                  id="barraAtual"
                  className={`h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-violet-500 shadow-[0_0_10px_rgba(6,182,212,0.6)] transition-all duration-500 ${
                    isFinished ? 'animate-pulse' : ''
                  }`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
              
              {/* Badges / Timers row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  {!isFinished && (
                    <span id="countTime" className="drag inline-flex items-center rounded-md border border-cyan-500/20 px-2.5 py-0.5 text-[10px] font-semibold bg-cyan-500/5 text-cyan-400 transition-colors shadow-sm font-mono tracking-tight">
                      <svg className="me-1.5 h-3 w-3 animate-pulse" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm3.982 13.982a1 1 0 0 1-1.414 0l-3.274-3.274A1.012 1.012 0 0 1 9 10V6a1 1 0 0 1 2 0v3.586l2.982 2.982a1 1 0 0 1 0 1.414Z" />
                      </svg>
                      {convertSecondsToHour(totalProgress)}
                    </span>
                  )}

                  {isFinished && (
                    <span id="finish" className="drag text-emerald-400 me-2 inline-flex animate-pulse items-center justify-center rounded-md border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/10 shadow-sm uppercase tracking-wider">
                      Finalizada
                    </span>
                  )}

                  {currentTimePause > 0 && !isFinished && (
                    <span id="timeStopCount" className="drag inline-flex items-center rounded-md border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold bg-red-500/5 text-red-400 font-mono shadow-sm">
                      <svg className="me-1 h-3 w-3 text-red-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M8 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H8Zm7 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1Z" clip-rule="evenodd" />
                      </svg>
                      -{convertSecondsToHour(currentTimePause)}
                    </span>
                  )}
                </div>

                {/* Navigation Toolbar */}
                <div className="inline-flex rounded-lg border border-neutral-900 bg-neutral-950/60 overflow-hidden shadow-sm" role="group">
                  <button type="button" onClick={handleBack} className="inline-flex items-center p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors duration-200">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button type="button" onClick={handleNext} className="inline-flex items-center p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors duration-200 border-l border-neutral-900">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>

            </div>

            {/* Sidebar Control Buttons */}
            <div className="inline-flex items-center">
              <div className="flex flex-col border border-neutral-900 bg-neutral-900/20 rounded-xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={handleControlClick}
                  disabled={isFinished}
                  className="inline-flex items-center justify-center p-2 text-neutral-400 hover:text-cyan-400 hover:bg-neutral-900 transition-colors duration-200 disabled:opacity-30 border-b border-neutral-900/60"
                >
                  {!active && !isFinished && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z" clip-rule="evenodd" />
                    </svg>
                  )}
                  {active && !isFinished && (
                    <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M8 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H8Zm7 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1Z" clip-rule="evenodd" />
                    </svg>
                  )}
                  {isFinished && (
                    <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M8 10V7a4 4 0 1 1 8 0v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2-3a2 2 0 1 1 4 0v3h-4V7Zm2 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z" clip-rule="evenodd" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={handleCheckpoint}
                  type="button"
                  title="Registrar Checkpoint"
                  disabled={!activity}
                  className="inline-flex items-center justify-center p-2 text-neutral-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors duration-200 disabled:opacity-30"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div id="off" className="drag px-2 py-1.5 flex items-center h-full">
          <div className="flex items-center space-x-3.5 rtl:space-x-reverse w-full">
            <div className="flex-shrink-0 relative">
              <img className="h-8 w-8 rounded-full border border-neutral-800 shadow-[0_0_10px_rgba(6,182,212,0.15)]" src={faviconImg} alt="Icon" />
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-cyan-500 border border-neutral-950"></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-neutral-100">WorkTimeBar</p>
              <p className="truncate text-[10px] text-neutral-500 leading-normal" dangerouslySetInnerHTML={{ __html: serverMsg }}></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
