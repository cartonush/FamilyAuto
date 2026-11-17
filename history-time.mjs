const dayNumber=date=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86_400_000;
const sameDay=(a,b)=>dayNumber(a)===dayNumber(b);
const time=date=>date.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const asDate=value=>{
 const date=value?.toDate?.()??value;
 return date instanceof Date&&Number.isFinite(date.getTime())?date:null;
};

function dayLabel(date,now){
 const days=dayNumber(date)-dayNumber(now);
 if(days===0)return 'היום';
 if(days===-1)return 'אתמול';
 if(days===1)return 'מחר';
 if(Math.abs(days)<7)return date.toLocaleDateString('he-IL',{weekday:'long'}).replace(/^יום\s+/,'');
 return date.toLocaleDateString('he-IL',{dateStyle:'short'});
}

export function formatHistoryMoment(value,now=new Date()){
 const date=asDate(value);
 return date?dayLabel(date,now)+' '+time(date):'לא ידוע';
}

export function formatHistoryRange(startValue,endValue,now=new Date()){
 const start=asDate(startValue),end=asDate(endValue);
 if(!start||!end)return 'לא ידוע';
 if(sameDay(start,end)){
  const first=dayLabel(start,now)+' '+time(start);
  return Math.floor(start.getTime()/60_000)===Math.floor(end.getTime()/60_000)
   ?first:first+' עד '+time(end);
 }
 return formatHistoryMoment(start,now)+' עד '+formatHistoryMoment(end,now);
}
