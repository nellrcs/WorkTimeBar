export default class Progress {
    constructor() {
        this.id = '';
        this.title = '';
        this.totalTimeSeconds = 0;
        this.totalTimeFloat = 0;
        this.totalProgress = 0;
        this.totalTimePause = 0;
        this.currentTimePause = 0;
        this.lastTimestempPlay = 0;
        this.lastTimestempPause = 0;
        this.active = false;
    }
}

export function convertSecondsToHour(seconds){
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds % 3600) / 60);
    let remainingSeconds = seconds % 60;
    if (hours > 0) {
        return (`00${Math.floor(hours)}`).slice(-2)  + ":" + (`00${Math.floor(minutes)}`).slice(-2) +":"+ (`00${Math.floor(remainingSeconds)}`).slice(-2) + "h"
    } else if (!hours && minutes > 0) {
        return "00:" + (`00${Math.floor(minutes)}`).slice(-2) +":"+ (`00${Math.floor(remainingSeconds)}`).slice(-2) + "h"
    }
    return "00:00:"+(`00${Math.floor(remainingSeconds)}`).slice(-2) + "h"
}  

export function convertFloatToHous(time){
    let hour = "";
    if(time >= 100 ){
      hour += (`000${Math.floor(time)}`).slice(-3)  + ":";
    }else{
      hour += (`00${Math.floor(time)}`).slice(-2)  + ":";
    }
    if(time <= 1){
      hour += (`00${parseInt((parseInt(time*100)*60) / 100)}`).slice(-2);
    }else{  
      hour += (`00${(Math.ceil(time*60) %60)}`).slice(-2);
    }
    return  {"tempo": hour + "h = " + time};
}

export  function convertSeconds(time){
    return parseInt(((time)*60)*60);
}

export function barPercentage(value,max){
  return parseInt( (100 * value) / max);
}