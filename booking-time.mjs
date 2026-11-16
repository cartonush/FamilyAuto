// Shared, deterministic instant-booking time calculation.
// "untilDone" reserves exactly 24 elapsed hours, including across DST changes.
export const INSTANT_HOLD_MS=24*60*60*1000;
export function instantUseEnd(start,mode,chosenEnd){
 if(!(start instanceof Date)||!Number.isFinite(start.getTime()))throw new TypeError('Invalid instant start');
 if(mode==='untilDone')return new Date(start.getTime()+INSTANT_HOLD_MS);
 if(mode==='fixed')return new Date(chosenEnd);
 throw new TypeError('Unknown instant-use mode');
}

/** Next occurrence of the chosen clock time, at least 15 minutes after start.
 * Choosing a time already passed today intentionally means tomorrow.
 * The date is displayed in the confirmation modal before booking.
 */
export function nextClockEnd(start,hour,minute){
 if(!(start instanceof Date)||!Number.isFinite(start.getTime())||
  !Number.isInteger(hour)||hour<0||hour>23||
  ![0,15,30,45].includes(minute))throw new TypeError('Invalid clock selection');
 const end=new Date(start.getFullYear(),start.getMonth(),start.getDate(),hour,minute,0,0);
 if(end.getTime()<start.getTime()+15*60*1000)end.setDate(end.getDate()+1);
 return end;
}
