import express from 'express'
const router = express.Router()
import { MongoClient } from 'mongodb'
import * as myDateTime from "../mymodule/myDateTime.js"
// import * as mySendMessage from "../mymodule/mySendMessage.js" 
// import path from 'path'
// import axios from 'axios'
// import * as myUsers from "../mymodule/myUsers.js" 
// //==========================================
// // สำหรับ บันทึกเวลาแจ้งเตือนล่าสุด
// let ES002_ALERT_TimeStamp = null
// let ES003_ALERT_TimeStamp = null
// const BOT_TOKEN = '8046567910:AAG8IhMqBMfxenMqbZapeULZGS546k83s28' // wasankds_bot
// const GROUP_CHAT_ID = '-4557511552'; // wasankds_group

/*****************************************************
******************************************************
******************************************************
******************* ESP - All ************************
******************************************************
******************************************************
*****************************************************/


//=== esp - connect - ใช้ได้กับทุกตัว
// เมื่อ connect ครั้งแรก ESP32 จะส่งค่า IP/MC Address มาให้
router.post('/esp/esp-connect', async (req, res) => {
  // console.log(`---------${req.originalUrl}---------`)
  // console.log('req.body ===> ', req.body)

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect();
    const db = client.db(global.dbName);
    const coll_esp32 = db.collection(global.dbColl_esp32);
    const { id, mac, ip } = req.body

    //=== ถ้ามีการส่ง id มาให้ ให้ update IP/MAC Address
    const esp32 = await coll_esp32.findOneAndUpdate(
      { espId: id },
      { $set: { espMacAddress:mac, espIpAddress:ip } },
      { returnDocument: 'after', upsert: false }
    );
    if(esp32) {
      res.send({ status:'ok', msg:'We connected'})
    }else{
      res.status(404).send({ status:'error',  msg:`ESP Not found : ${id}` })
    }
  }catch(error){
    console.error('Error in / route:', error.message);
    res.status(500).send({ status : 'error', msg: error.message });    
  }finally{
    client.close();
  }
})



/*****************************************************
******************************************************
******************************************************
******************* ES002 ****************************
******************************************************
******************************************************
*****************************************************/


// //=== esp001 - data loop
// router.post('/esp/es001', async (req, res) => {
//   // console.log(`---------${req.originalUrl}---------`)
//   // console.log('req.body ===> ', req.body)

//   const client = new MongoClient(dbUrl);
//   try{
//     const timestamp = myDateTime.getTimestamp()
//     req.body.timestamp = timestamp
//     // console.log('req.body ===> ', req.body)

//     //=== เชียนข้อมูลลงในช่วง 10 นาที บันทึกเฉพาะค่า min-max
//     await client.connect();
//     const db = client.db(dbName);
//     const collection = db.collection(dbColl_es001);    
//     const timeInterval = timestamp.substring(0, 15) + '0'; // Round timestamp to the nearest 10-minute interval    
//     const existingDoc = await collection.findOne({ timeInterval: timeInterval }); 

//     // 1.1) Update the existing document
//     if (existingDoc) { 
//       const rtn = await collection.updateOne(
//         { timeInterval: timeInterval },
//         {
//           $max: { tmax: req.body.t, hmax: req.body.h, },
//           $min: { tmin: req.body.t, hmin: req.body.h },
//           $set: { 
//             tavg: parseFloat(((existingDoc.tavg * existingDoc.count + req.body.t) / (existingDoc.count + 1)).toFixed(2)),
//             havg: parseFloat(((existingDoc.havg * existingDoc.count + req.body.h) / (existingDoc.count + 1)).toFixed(2)),
//           },
//           $inc: { count: 1 },
//         }
//       );
//       if(rtn.modifiedCount === 1) {
//         var count = existingDoc.count
//       }
//     } 
//     // 1.2) Insert a new document
//     else { 
//       const rtn = await collection.insertOne({
//         tmax: req.body.t, tmin: req.body.t,
//         hmax: req.body.h, hmin: req.body.h,
//         tavg: req.body.t, havg: req.body.h,
//         count: 1,
//         timeInterval: timeInterval,
//       });
//       if(rtn.acknowledged) {
//         var count = 1
//       }
//     }
//     client.close();

//     // console.log('data ===> ', data)  
//     req.body.count = count
//     req.io.emit('es001_deviceState', { data: req.body });
//     res.send({ status : 'ok', msg: 'I have got your data'});
//   }catch(error){
//     console.error('Error in / route:', error.message);
//     res.status(500).send({ status : 'error', msg: error.message });
//   }finally{
//     client.close();
//   }
// })




/*****************************************************
******************************************************
******************************************************
******************* ES002 ****************************
******************************************************
******************************************************
*****************************************************/



// //=== esp002 - data - loop
// router.post('/esp/es002', async (req, res) => {
//   // console.log(`---------${req.originalUrl}---------`)
//   // console.log('req.body ===> ', req.body)

//   const client = new MongoClient(dbUrl)
//   try{
//     const timestamp = myDateTime.getTimestamp()
//     req.body.timestamp = timestamp
//     // console.log('req.body ===> ', req.body)
//     // { t: 31.2, h: 82.5, g: 394, timestamp: '2025-05-01 09:41:01' }

//     //=== เชียนข้อมูลลงในช่วง 10 นาที บันทึกเฉพาะค่า min-max    
//     const esp32 = await get_esp_1min('es002')
//     if(esp32 && esp32.sensors && esp32.sensors.length > 0){
//       const triggers = esp32.sensors.filter(sensor => sensor.sensorTriggerKey !== '')
//       // const t_t = triggers.find(sensor => sensor.sensorTriggerKey == 't_t').sensorTriggerValue || null;
//       // const t_h = triggers.find(sensor => sensor.sensorTriggerKey == 't_h')?.sensorTriggerValue || null;
//       var t_g = triggers.find(sensor => sensor.sensorTriggerKey == 't_g').sensorTriggerValue || null;
//     }
//     // console.log('t_g ===> ', t_g)
    
    
//     //=== ถ้าค่าสูงกว่า Threshold ใน Setting ให้ส่ง Triger เป็น Telegram
//     // - ส่งแล้วให้บันทึกลงฐานข้อมูลด้วย 
//     // - และส่งจากครั้งล่าสุด ต้องห่างกัน 1 นาที หรืออื่นๆนาที ตาม settings
//     if(t_g && req.body.g && req.body.g > t_g ){
//       let willSendAlert = false
//       if (ES002_ALERT_TimeStamp) {
//         const lastAlertTime = new Date(ES002_ALERT_TimeStamp).getTime()
//         const currentTime = new Date(req.body.timestamp).getTime()
//         willSendAlert = currentTime - lastAlertTime < 60000 ? false : true
//       }else{
//         willSendAlert = true
//       }
//       // console.log('willSendAlert ===> ', willSendAlert)

//       if(willSendAlert){
//         // แสตมป์ว่าส่งอีกครั้งเมื่อไร
//         ES002_ALERT_TimeStamp = req.body.timestamp; 
//         // ส่งข้อความไปยัง Telegram Group
//         const msg = `⚠️ Gas Value too high: ${req.body.g} ADC\n` +
//                     `ESP02 @ ${req.body.timestamp}`
                    
//         const response = await mySendMessage.sendTelegramNotifyToGroup(msg, BOT_TOKEN, GROUP_CHAT_ID)
//         // เขียนลงฐานข้อมูล allert
//         if(response.status == 200) {
//           const db = client.db(dbName);
//           const coll_es002_tg = db.collection(dbColl_es002_tg);
//           const data = {
//             // espId: req.body.id,
//             id: req.body.id,
//             timestamp: req.body.timestamp,
//             msg: msg,
//             value: req.body.g,
//             t_value : t_g
//           }
//           // เขียนลงฐานข้อมูล allert
//           coll_es002_tg.insertOne(data);
//           // ส่ง socket.io ไปยัง client
//           req.io.emit('es002_tg', data);
//         }
//       }
//     }

//     await client.connect();
//     const db = client.db(dbName);
//     const timeInterval = timestamp.substring(0, 15) + '0'; // Round timestamp to the nearest 10-minute interval    
//     const coll_es002 = db.collection(dbColl_es002);
//     const existingDoc = await coll_es002.findOne({ timeInterval: timeInterval }); 
//     // console.log('timeInterval ===> ', timeInterval)
//     // console.log('existingDoc ===> ', existingDoc)
//     if (existingDoc) { // Update the existing document
//       const rtn = await coll_es002.updateOne(
//         { timeInterval: timeInterval },
//         {
//           $max: { tmax: req.body.t, hmax: req.body.h, gmax: req.body.g },
//           $min: { tmin: req.body.t, hmin: req.body.h, gmin: req.body.g },
//           $set: { 
//             tavg: parseFloat(((existingDoc.tavg * existingDoc.count + req.body.t) / (existingDoc.count + 1)).toFixed(2)),
//             havg: parseFloat(((existingDoc.havg * existingDoc.count + req.body.h) / (existingDoc.count + 1)).toFixed(2)),
//             gavg: parseFloat(((existingDoc.gavg * existingDoc.count + req.body.g) / (existingDoc.count + 1)).toFixed(2)),
//           },
//           $inc: { count: 1 }, 
//         }
//       );
//       if(rtn.modifiedCount === 1) {
//         var count = existingDoc.count
//       }
//     } else { // Insert a new document
//       const rtn = await coll_es002.insertOne({
//         tmax: req.body.t, tmin: req.body.t,
//         hmax: req.body.h, hmin: req.body.h,
//         gmax: req.body.g, gmin: req.body.g,
//         tavg: req.body.t, 
//         havg: req.body.h,
//         gavg: req.body.g,
//         count: 1,
//         timeInterval: timeInterval,
//       });
//       if(rtn.acknowledged) {
//         var count = 1
//       }
//     }
//     // console.log('data ===> ', data)  
//     req.body.count = count
//     req.io.emit('es002_deviceState', { data: req.body });
//     res.send({ status : 'ok', msg: 'I have got your data'});
//   }catch(error){
//     console.error('Error /esp/es002 ===> ', error.message);
//     res.status(500).send({ status : 'error', msg: error.message });    
//   }finally{
//     client.close();
//   }
// })



// //=== esp002 - setting
// // เมื่อกดปุ่มจะมาเอาการตั้งค่า GT จากฐานข้อมูล
// router.post('/esp/es002-setting', async (req, res) => {
//   // console.log(`---------${req.originalUrl}---------`)
//   // console.log('req.body ===> ', req.body)

//   const client = new MongoClient(dbUrl)
//   try{
//     const { id } = req.body

//     // ต้องส่งค่า GT ของเก่ามาก่อน 
//     await client.connect();
//     const db = client.db(dbName);
//     const coll_esp32 = db.collection(dbColl_esp32)

//     //=== ถ้ามีการส่ง id มาให้ ให้ update IP/MAC Address
//     const esp32 = await coll_esp32.findOne({ espId: id })
//     if(esp32 && esp32.sensors && esp32.sensors.length > 0){
//       const triggers = esp32.sensors.filter(sensor => sensor.sensorTriggerKey !== '')
//       const t_t = triggers.find(sensor => sensor.sensorTriggerKey == 't_t')?.sensorTriggerValue || null;
//       const t_h = triggers.find(sensor => sensor.sensorTriggerKey == 't_h')?.sensorTriggerValue || null;
//       const t_g = triggers.find(sensor => sensor.sensorTriggerKey == 't_g')?.sensorTriggerValue || null;
//       res.send({ 
//         t_t: t_t,
//         t_h: t_h,
//         t_g: t_g,
//         msg: `Set New GT`
//       });
//     }else{
//       res.status(404).send({ status:'error',  msg:`ESP Not found : ${id}` })
//     }
//   }catch(error){
//     console.error('Error /esp/es002-setting ===> ', error.message);
//     res.status(500).send({ status : 'error', msg: error.message });    
//   }finally{
//     client.close();
//   }
// })


/*****************************************************
******************************************************
******************************************************
******************* ES003 ****************************
******************************************************
******************************************************
*****************************************************/



// //=== esp003 - 
// router.post('/esp/es003', async (req, res) => {
//   // console.log(`---------${req.originalUrl}---------`)
//   // console.log('req.body ===> ', req.body)

//   const client = new MongoClient(dbUrl)
//   try{
//     const timestamp = myDateTime.getTimestamp()
//     req.body.timestamp = timestamp
//     // console.log('req.body ===> ', req.body)
//     // { t: 31.2, h: 82.5, g: 394, timestamp: '2025-05-01 09:41:01' }

//     //=== เชียนข้อมูลลงในช่วง 10 นาที บันทึกเฉพาะค่า min-max    
//     const esp32 = await get_esp_1min('es003')
//     if(esp32 && esp32.sensors && esp32.sensors.length > 0){
//       const triggers = esp32.sensors.filter(sensor => sensor.sensorTriggerKey !== '')
//       // const t_t = triggers.find(sensor => sensor.sensorTriggerKey == 't_t').sensorTriggerValue || null;
//       // const t_h = triggers.find(sensor => sensor.sensorTriggerKey == 't_h')?.sensorTriggerValue || null;
//       var t_d = triggers.find(sensor => sensor.sensorTriggerKey == 't_d')?.sensorTriggerValue || null;
//     }
//     // console.log('t_d ===> ', t_d)

//     //=== ถ้าค่าสูงกว่า Threshold ใน Setting ให้ส่ง Triger เป็น Telegram
//     // - ส่งแล้วให้บันทึกลงฐานข้อมูลด้วย 
//     // - และส่งจากครั้งล่าสุด ต้องห่างกัน 1 นาที หรืออื่นๆนาที ตาม settings
//     if(t_d && req.body.d && req.body.d < t_d ){
//       let willSendAlert = false
//       if (ES003_ALERT_TimeStamp) {
//         const lastAlertTime = new Date(ES003_ALERT_TimeStamp).getTime()
//         const currentTime = new Date(req.body.timestamp).getTime()
//         willSendAlert = currentTime - lastAlertTime < 60000 ? false : true
//       }else{
//         willSendAlert = true
//       }

//       if(willSendAlert){
//         // แสตมป์ว่าส่งอีกครั้งเมื่อไร
//         ES003_ALERT_TimeStamp = req.body.timestamp; 
//         // ส่งข้อความไปยัง Telegram Group
//           const msg = `⚠️Somebody is too close: ${req.body.d} cm\n` +
//                      `ESP03 @ ${req.body.timestamp}`
//           const response = await mySendMessage.sendTelegramNotifyToGroup(msg, BOT_TOKEN, GROUP_CHAT_ID)
//         // เขียนลงฐานข้อมูล allert
//         if(response.status == 200) {
//           const db = client.db(dbName);
//           const coll_es003_tg = db.collection(dbColl_es003_tg);
//           const data = {
//             // espId: req.body.id,
//             id: req.body.id ? req.body.id : 'es003',
//             timestamp: req.body.timestamp,
//             value: req.body.d,
//             t_value : t_d,
//             msg: msg
//           }
//           // เขียนลงฐานข้อมูล allert
//           coll_es003_tg.insertOne(data);
//           // ส่ง socket.io ไปยัง client
//           req.io.emit('es003_tg', data);
//         }
//       }
//     }

//     //=== เชียนข้อมูลลงในช่วง 10 นาที บันทึกเฉพาะค่า min-max
//     await client.connect();
//     const db = client.db(dbName);
//     const collection = db.collection(dbColl_es003);    
//     const timeInterval = timestamp.substring(0, 15) + '0'; // Round timestamp to the nearest 10-minute interval    
//     const existingDoc = await collection.findOne({ timeInterval: timeInterval }); 
//     // console.log('timeInterval ===> ', timeInterval)
//     // console.log('existingDoc ===> ', existingDoc)
//     if (existingDoc) { // Update the existing document
//       const rtn = await collection.updateOne(
//         { timeInterval: timeInterval },
//         {
//           $max: { tmax: req.body.t, hmax: req.body.h, dmax: req.body.d },
//           $min: { tmin: req.body.t, hmin: req.body.h, dmin: req.body.d },
//           $set: { 
//             tavg: parseFloat(((existingDoc.tavg * existingDoc.count + req.body.t) / (existingDoc.count + 1)).toFixed(2)),
//             havg: parseFloat(((existingDoc.havg * existingDoc.count + req.body.h) / (existingDoc.count + 1)).toFixed(2)),
//             davg: parseFloat(((existingDoc.davg * existingDoc.count + req.body.d) / (existingDoc.count + 1)).toFixed(2)),
//           },
//           $inc: { count: 1 }, 
//         }
//       );
//       if(rtn.modifiedCount === 1) {
//         var count = existingDoc.count
//       }
//     } else { // Insert a new document
//       const rtn = await collection.insertOne({
//         tmax: req.body.t, tmin: req.body.t,
//         hmax: req.body.h, hmin: req.body.h,
//         dmax: req.body.d, dmin: req.body.d,
//         tavg: req.body.t, 
//         havg: req.body.h,
//         davg: req.body.d,
//         count: 1,
//         timeInterval: timeInterval,
//       });
//       if(rtn.acknowledged) {
//         var count = 1
//       }
//     }
//     // console.log('data ===> ', data)  
//     req.body.count = count
//     req.io.emit('es003_deviceState', { data: req.body });
//     res.send({ status : 'ok', msg: 'I have got your data'});
//   }catch(error){
//     console.error('Error /esp/es003 ===>', error.message);
//     res.status(500).send({ status : 'error', msg: error.message });    
//   }finally{
//     client.close();
//   }
// })



// //=== esp003 - setting
// // เมื่อกดปุ่มจะมาเอาการตั้งค่า GT จากฐานข้อมูล
// router.post('/esp/es003-setting', async (req, res) => {
//   // console.log(`---------${req.originalUrl}---------`)
//   // console.log('req.body ===> ', req.body)

//   const client = new MongoClient(dbUrl)
//   try{
//     const { id } = req.body

//     // ต้องส่งค่า GT ของเก่ามาก่อน 
//     await client.connect();
//     const db = client.db(dbName);
//     const coll_esp32 = db.collection(dbColl_esp32)

//     //=== ถ้ามีการส่ง id มาให้ ให้ update IP/MAC Address
//     const esp32 = await coll_esp32.findOne({ espId: id })
//     if(esp32 && esp32.sensors && esp32.sensors.length > 0){
//       const triggers = esp32.sensors.filter(sensor => sensor.sensorTriggerKey !== '')
//       // console.log('triggers ===> ', triggers)
//       const t_t = triggers.find(sensor => sensor.sensorTriggerKey == 't_t')?.sensorTriggerValue || null;
//       const t_h = triggers.find(sensor => sensor.sensorTriggerKey == 't_h')?.sensorTriggerValue || null;
//       const t_d = triggers.find(sensor => sensor.sensorTriggerKey == 't_d')?.sensorTriggerValue || null;
//       res.send({ 
//         t_t: t_t,
//         t_h: t_h,
//         t_d: t_d,
//         msg: `Set New GT`
//       });
//     }else{
//       res.status(404).send({ status:'error',  msg:`ESP Not found : ${id}` })
//     }
//   }catch(error){
//     console.error('Error /esp/es003-setting ===> ', error.message);
//     res.status(500).send({ status : 'error', msg: error.message });    
//   }finally{
//     client.close();
//   }
// })






/*****************************************************
******************************************************
******************************************************
******************* ES004 ****************************
******************************************************
******************************************************
*****************************************************/





// //=== esp004 - 
// router.post('/esp/es004', async (req, res) => {
//   // console.log(`---------${req.originalUrl}---------`)
//   // console.log('req.body ===> ', req.body)

//   //  { s1: 0, s2: 1 } // ถ้าเปลี่ยนจากค่าล่าสุดใน DB จึงจะบันทึก DB ใหม่ 
  
//   const client = new MongoClient(dbUrl)
//   try{
//     const timestamp = myDateTime.getTimestamp()   
//     req.body.timestamp = timestamp
//     // console.log('req.body ===> ', req.body)

//     req.io.emit('es004_deviceState', { data: req.body });
//     res.send({ status:'ok', msg:'I have got your data'});

//     // //=== เชียนข้อมูลลงในช่วง 10 นาที บันทึกเฉพาะค่า min-max
//     // await client.connect();
//     // const db = client.db(dbName);
//     // const collection = db.collection(dbColl_es003);    
//     // const timeInterval = timestamp.substring(0, 15) + '0'; // Round timestamp to the nearest 10-minute interval    
//     // const existingDoc = await collection.findOne({ timeInterval: timeInterval }); 
//     // // console.log('timeInterval ===> ', timeInterval)
//     // // console.log('existingDoc ===> ', existingDoc)
//     // if (existingDoc) { // Update the existing document
//     //   const rtn = await collection.updateOne(
//     //     { timeInterval: timeInterval },
//     //     {
//     //       $max: { tmax: req.body.t, hmax: req.body.h, dmax: req.body.d },
//     //       $min: { tmin: req.body.t, hmin: req.body.h, dmin: req.body.d },
//     //       $set: { 
//     //         tavg: parseFloat(((existingDoc.tavg * existingDoc.count + req.body.t) / (existingDoc.count + 1)).toFixed(2)),
//     //         havg: parseFloat(((existingDoc.havg * existingDoc.count + req.body.h) / (existingDoc.count + 1)).toFixed(2)),
//     //         davg: parseFloat(((existingDoc.davg * existingDoc.count + req.body.d) / (existingDoc.count + 1)).toFixed(2)),
//     //       },
//     //       $inc: { count: 1 }, 
//     //     }
//     //   );
//     //   if(rtn.modifiedCount === 1) {
//     //     var count = existingDoc.count
//     //   }
//     // } else { // Insert a new document
//     //   const rtn = await collection.insertOne({
//     //     tmax: req.body.t, tmin: req.body.t,
//     //     hmax: req.body.h, hmin: req.body.h,
//     //     dmax: req.body.d, dmin: req.body.d,
//     //     tavg: req.body.t, 
//     //     havg: req.body.h,
//     //     davg: req.body.d,
//     //     count: 1,
//     //     timeInterval: timeInterval,
//     //   });
//     //   if(rtn.acknowledged) {
//     //     var count = 1
//     //   }
//     // }
//     // // console.log('data ===> ', data)  
//     // req.body.count = count
//   }catch(error){
//     console.error('Error in / route:', error.message);
//     res.status(500).send({ status : 'error', msg: error.message });    
//   }finally{
//     client.close();
//   }
// })



export default router







//====================================
// 
async function get_esp_1min(espId) {
  const interval = 60000
  const timestamp = myDateTime.getTimestamp()
  // console.log('get_esp_1min ===> ', espId)

  const client = new MongoClient(dbUrl)
  await client.connect();
  const db = client.db(dbName);
  const coll_esp32 = db.collection(dbColl_esp32)
  if(GLOBAL_ESP_1MIN == null) {
    GLOBAL_ESP_1MIN = await coll_esp32.find({
      // espId: espId, // sensors: { $elemMatch: { sensorTriggerKey: 't_t' } }      
    },{projection:{ _id:0}}).toArray()
    GLOBAL_ESP_1MIN.timestamp = timestamp
  }else{
    const timestampSettings = new Date(GLOBAL_ESP_1MIN.timestamp).getTime()
    const currentTime = new Date(timestamp).getTime()
    const diff = currentTime - timestampSettings
    
    if(diff >= interval) { // ถ้าตั้งค่าเกิน 1 นาทีให้ไปอ่านใหม่
      GLOBAL_ESP_1MIN = await coll_esp32.find({
        // espId: espId, // sensors: { $elemMatch: { sensorTriggerKey: 't_t' } }
      },{projection:{ _id:0}}).toArray()
      GLOBAL_ESP_1MIN.timestamp = timestamp
    }
  }
  // console.log('GLOBAL_ESP_1MIN ===> ', GLOBAL_ESP_1MIN)

  client.close()
  return GLOBAL_ESP_1MIN.filter( esp => {
    return esp.espId == espId
  })[0]
}
