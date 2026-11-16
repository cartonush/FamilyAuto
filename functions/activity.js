const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const db=getFirestore();
const labels={pending:'בקשה חדשה',approved:'הרכב הוזמן',rejected:'הבקשה נדחתה',cancelled:'ההזמנה בוטלה',ended:'השימוש הסתיים'};
exports.recordBookingActivity=onDocumentWritten(
 {document:'houses/{houseId}/bookingRequests/{bookingId}',region:'europe-west1'},
 async event=>{
  const before=event.data?.before.exists?event.data.before.data():null;
  const after=event.data?.after.exists?event.data.after.data():null;
  if(!after||!labels[after.status]||before?.status===after.status)return;
  const ref=db.doc('houses/'+event.params.houseId+'/activity/'+event.id);
  try{
   await ref.create({
    bookingId:event.params.bookingId,
    eventType:after.status,
    title:labels[after.status],
    displayName:after.displayName||'חבר בית',
    createdBy:after.createdBy,
    startAt:after.startAt,
    endAt:after.endAt,
    occurredAt:FieldValue.serverTimestamp()
   });
  }catch(e){if(e.code===6||e.code==='already-exists')return;throw e}
 }
);
