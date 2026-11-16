const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');
initializeApp();
const db=getFirestore();

const messageFor=(before,after)=>{
 if(!before&&after.status==='pending')return {type:'pending',title:'FamilyAuto',body:'התקבלה בקשה חדשה לשימוש ברכב.',destination:'requests'};
 if((!before||before.status!=='approved')&&after.status==='approved')return {type:'approved',title:'FamilyAuto',body:'עדכון חדש על הרכב התקבל, בדקו!',destination:'calendar'};
 if(before?.status!==after.status&&after.status==='rejected')return {type:'rejected',title:'FamilyAuto',body:'התקבל עדכון על בקשת הרכב שלך.',destination:'requests'};
 if(before?.status!==after.status&&after.status==='cancelled')return {type:'cancelled',title:'FamilyAuto',body:'הזמנה או בקשה לרכב בוטלה. בדקו את לוח השנה.',destination:'calendar'};
 if(before?.status!==after.status&&after.status==='ended')return {type:'ended',title:'FamilyAuto',body:'השימוש ברכב הסתיים. בדקו את הזמינות.',destination:'calendar'};
 return null;
};

exports.notifyBookingChange=onDocumentWritten(
 {document:'houses/{houseId}/bookingRequests/{bookingId}',region:'europe-west1'},
 async event=>{
  const before=event.data?.before.exists?event.data.before.data():null;
  const after=event.data?.after.exists?event.data.after.data():null;
  if(!after)return;
  const message=messageFor(before,after);
  if(!message)return;
  const houseId=event.params.houseId;
  const houseSnap=await db.doc('houses/'+houseId).get();
  if(!houseSnap.exists)return;
  const house=houseSnap.data();
  if(house.deletedAt)return;
  const members=Array.isArray(house.memberIds)?house.memberIds:[];
  let recipients=[];
  if(message.type==='pending')recipients=[house.ownerUid];
  else if(message.type==='rejected')recipients=[after.createdBy];
  else if(message.type==='approved')recipients=members.filter(uid=>uid!==after.approvedBy);
  else recipients=members.filter(uid=>uid!==after.createdBy&&uid!==after.approvedBy);
  recipients=[...new Set(recipients)].filter(uid=>typeof uid==='string'&&uid.length>0&&!(message.type==='pending'&&uid===after.createdBy));
  if(!recipients.length)return;

  // Claim this event once to prevent duplicate notifications on trigger retries.
  const claim=db.doc('notificationDeliveries/'+event.id);
  try{await claim.create({houseId,bookingId:event.params.bookingId,type:message.type,createdAt:new Date()})}
  catch(e){if(e.code===6||e.code==='already-exists')return;throw e}

  const tokenRefs=[];
  for(const uid of recipients){
   const snap=await db.collection('users').doc(uid).collection('pushTokens').where('enabled','==',true).get();
   snap.forEach(d=>{if(typeof d.data().token==='string')tokenRefs.push({ref:d.ref,token:d.data().token})});
  }
  for(let i=0;i<tokenRefs.length;i+=500){
   const group=tokenRefs.slice(i,i+500);
   const response=await getMessaging().sendEachForMulticast({
    tokens:group.map(x=>x.token),
    data:{
     title:message.title,body:message.body,destination:message.destination,
     eventId:event.id,type:message.type
    },
    webpush:{headers:{TTL:'3600',Urgency:'normal'}}
   });
   for(let j=0;j<response.responses.length;j++){
    const error=response.responses[j].error;
    if(error&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)){
     await group[j].ref.delete().catch(()=>{});
    }
   }
  }
 }
);

Object.assign(exports,require('./account.js'));

Object.assign(exports,require('./activity.js'));
