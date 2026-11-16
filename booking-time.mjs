// Shared, deterministic instant-booking time calculation.
// "untilDone" reserves exactly 24 elapsed hours, including across DST changes.
export const INSTANT_HOLD_MS=24*60*60*1000;
export function instantUseEnd(start,mode,chosenEnd){
 if(!(start instanceof Date)||!Number.isFinite(start.getTime()))throw new TypeError('Invalid instant start');
 if(mode==='untilDone')return new Date(start.getTime()+INSTANT_HOLD_MS);
 if(mode==='fixed')return new Date(chosenEnd);
 throw new TypeError('Unknown instant-use mode');
}
