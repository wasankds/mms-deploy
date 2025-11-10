
//===========================================
// เป็น Router ทีที่ถูกเรียกใช้ได้จากทุกหน้า
// - เช่นการจับลายเซ็นของ Active User / พิมพ์เอกสาร
// 
// import ejs from 'ejs'
// import fs from 'fs'
import express from 'express' ;
const router = express.Router()  ;
import path from 'path' ;
import { MongoClient } from 'mongodb'  ;
import mainAuth from "../middleware/mainAuth.js"  ;
import * as myUsers from "../mymodule/myUsers.js"  ;
import * as myDateTime from "../mymodule/myDateTime.js"  ;
import * as myModule from "../mymodule/myModule.js"  ;
import * as myDocMain from "../mymodule/myDocMain.js"  ;
import * as myData from "../mymodule/myData.js"  ;
import { DateTime } from 'luxon'
const WAREHOUSE_IN = global.PATH_WAREHOUSE_IN
const WAREHOUSE_OUT = global.PATH_WAREHOUSE_OUT
const SALES = global.PATH_SALES
const PATH_CHANGES_ARR = [`${WAREHOUSE_IN}/changes`, `${WAREHOUSE_OUT}/changes`, `${SALES}/changes`]
const PATH_PRINT_ARR = [`${WAREHOUSE_IN}/print`, `${WAREHOUSE_OUT}/print`, `${SALES}/print`]
const PATH_STATUS_ARR = [`${WAREHOUSE_IN}/status`, `${WAREHOUSE_OUT}/status`, `${SALES}/status`]
const PATH_SEARCH_ARR = [`${WAREHOUSE_IN}/search`, `${WAREHOUSE_OUT}/search`, `${SALES}/search`]
const PATH_LOAD_ARR = [ // ใช้ได้ทั้ง load by docId และ load last
  `${WAREHOUSE_IN}/load`, `${WAREHOUSE_OUT}/load`, `${SALES}/load`,
  `${WAREHOUSE_IN}/load-last`, `${WAREHOUSE_OUT}/load-last`, `${SALES}/load-last`
]
const PATH_FETCH_ARR = [`${WAREHOUSE_IN}/fetch/modal`, `${WAREHOUSE_OUT}/fetch/modal`, `${SALES}/fetch/modal`]

//================================================================
// fetch ข้อมูลสำหรับทำ Modal Selector
// 
router.get(PATH_FETCH_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.body)

  const user = await myUsers.getUserData(req)
  const pathObj = await myDocMain.getMainDocPathObj(req,res, user.userAuthority)
  // console.log('pathObj :', pathObj);
  // console.log('pathObj.DOC_TYPE ===> ', pathObj.DOC_TYPE);
  try{
    //=== จับข้อมูล Items สำหรับใช้ทำ Modal/Buttons
    // - จับต่างกันถ้าเป็น warehouseIn/warehouseOut จับแต่พวกมี Stock
    // - แต่ถ้าเป็น sales จับพวก active ทั้งหมด
    if(pathObj.DOC_TYPE == 'warehouseIn'){
      var DATA_ITEMS = await myData.getItems_for_Modal('stock')
    }else if(pathObj.DOC_TYPE == 'warehouseOut'){
      var DATA_ITEMS = await myData.getItems_for_Modal('stock')
    }else if(pathObj.DOC_TYPE == 'sales') {
      var DATA_ITEMS = await myData.getItems_for_Modal('active')
    }
    // console.log('DATA_ITEMS.length ===> ', DATA_ITEMS.length);

    //=== จับข้อมูล ItemsCategory สำหรับใช้ทำ Modal/Buttons
    const DATA_CATEGORY = await myData.getItemsCategory()

    return res.send(JSON.stringify({
      DATA_ITEMS,
      DATA_CATEGORY,
      isFetch: true ,
      class:"green", 
      msg:`โหลดข้อมูลทั้งหมดเรียบร้อยแล้ว`
    }))
  }catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isFetch : false ,
      class : "red", 
      msg : err.message,
    }))
  }
})



//================================================================
//
// 
router.post(PATH_SEARCH_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.body)

  //=== 0.1) 
  let { sip } = req.body
  if(!sip && sip.length < 2){
    return res.send(JSON.stringify({
      isSearch: false,
      class:"yellow", 
      msg:"กรุณาระบุคำค้นหา 2 ตัวอักษรขึ้นไป"
    }))
  }

  sip = sip.replace(/[!@#$%^&*<>]/g, '') ?? null // กรองอักขระต้องห้ามทิ้งไป

  // //===0.2) ค้นหาได้เฉพาะของตนเองเท่านั้น ยกเว้น O และ A
  // let { 
  //   userId:userId_session, 
  //   userAuthority: userAuthority_session 
  // } = myUsers.getSessionData(req)
  const user = await myUsers.getUserData(req)
  await myDocMain.getMainDocPathObj(req,res, user.userAuthority)

  //=== 0.3) จับชื่อฐานข้อมูล
  const {collectionName} = myData.get_Info_ByUrl(req.originalUrl)
 
  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(collectionName)

    //== 1) สร้าง pipeline สำหรับค้นหา
    const matchConditions = [
      {
        $or: [
          { docId: { $regex: sip, $options: 'i' } },
          // { docDate: { $regex: sip, $options: 'i' } },
          { docDateTime: { $regex: sip, $options: 'i' } },
        ],
      }
    ];

    //== 2) เพิ่มเงื่อนไข userId - ถ้าไม่ใช่ O/S จะดูได้เฉพาะของตนเอง
    let msg = ''
    if (!['O','S'].includes( user.userAuthority)) {
      msg += '{{sep}}[ ค้นหาเฉพาะของตนเอง ]'
      matchConditions.push({ userId: user.userId });
    }

    //== 2) สร้าง pipeline สำหรับค้นหา
    const searchFound = await collection.aggregate([
      { $match: { $and: matchConditions } },
      { $project: {
          _id: 0,
          docId: 1, 
          docStatusNumber: 1, 
          docDateTime : 1,
          userId: 1,
        }
      }
    ]).toArray();      

    //=== 3.) คืนค่าผลลัพธ์
    msg = `พบ "${searchFound.length}" เอกสาร` + msg
    return res.send(JSON.stringify({
      searchFound, 
      msg, 
      isSearch:true, 
      class:"green", 
    }))
  }catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isSearch: false, 
      class:"red", 
      msg:err.message,
    }))
  }finally{
    client.close()
  }
})


//=============================================
//
//
router.post(PATH_LOAD_ARR, mainAuth.isAuth, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.body)

  //=== 0.1) จับค่าจาก request body
  // docId อาจไม่มี ถ้าเป็น load-last
  let { docId, action } = req.body 

  //=== 0.2) ค้นหาได้เฉพาะของตนเองเท่านั้น ยกเว้น O และ A
  const user = await myUsers.getUserData(req)
  await myDocMain.getMainDocPathObj(req, res, user.userAuthority)

  //=== 0.3) จับชื่อฐานข้อมูล
  const {collectionName} = myData.get_Info_ByUrl(req.originalUrl)

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(collectionName)

    //=== 1.1) โหลดเอกสารตาม docId
    if(action === 'load') {
      // - ถ้าไม่ใช่ O/S โหลดได้เฉพาะของตนเอง ( A/U โหลดได้เฉพาะของตนเอง )
      const matchConditions = !['O','S'].includes(user.userAuthority) 
        ? { docId:docId, userId:user.userId }
        : { docId:docId } ;
      var docFind = await collection.findOne( 
        matchConditions ,
        { projection: { _id:0, changesHistory:0 }  }
      )
    }
    //== 1.2) โหลดเอกสารตัวสุดท้าย (เรียงตาม _id ล่าสุด)
    else if(action === 'load-last') {  
      var docFind = await collection.findOne(
        { userId: user.userId }, 
        { sort: { _id: -1 } } ,
        { projection: { _id:0, changesHistory:0 } }
      )
    }

    //=== 2.) ไม่พบ
    let msg_error = docFind ? '' : ( action === 'load' ? `ไม่พบเอกสารเลขที่ "${docId}"` : 'ไม่พบเอกสารล่าสุด' )
    if(!docFind){
      return res.send(JSON.stringify({
        isLoad: false ,
        class:"red", 
        msg: msg_error
      }))
    }

    //=== 3.) เปรียบเทียบว่าปัจจุบัน ว่ามากกว่า dateTimeCanEdit หรือไม่ 
    // - ถ้าเกินแล้วให้สแตมป์ docStatusNumber เป็น 2[จบ] ****
    let msg = `โหลดเอกสารเลขที่ "${docFind.docId}" {{sep}}เรียบร้อยแล้ว`
    if(docFind.docStatusNumber == 1 && docFind.dateTimeCanEdit){
      let checkObj  = await myData.check_DocDateTime_CanEdit(docFind, collectionName, user.userId);
      docFind.dateTimeEditRemain = checkObj.dateTimeEditRemain
      if(checkObj.canEdit == false){
        docFind.docStatusNumber = checkObj.docStatusNumber
        msg += '{{sep}}[ เลยกำหนดแก้ไข สถานะถูก{{sep}}เปลี่ยนเป็น 2 อัตโนมัติ]'
      }
    }else{
      docFind.dateTimeEditRemain = '-'
    }
    if( (docFind.docStatusNumber == 1 || docFind.docStatusNumber == 2) && docFind.dateTimeCanCancel){
      const checkObj = await myData.check_DocDateTime_CanCancel(docFind, collectionName, user.userId)
      docFind.dateTimeCancelRemain = checkObj.dateTimeCancelRemain;
      if(checkObj.canCancel == false){
        msg += '{{sep}}[ เลยกำหนดยกเลิกเอกสารแล้ว ]'
      }
    }else{
      docFind.dateTimeCancelRemain = '-'
    }


    // - branchName - ต้องส่งไปด้วยตอนโหลด เพราะต้องใช้ชื่อปัจจบันจากฐานข้อมูล
    const { branchName } = await myData.getUserBranchesById(docFind.branchId)
    docFind.branchName = branchName 

    // console.log('docFind ===> ', docFind);

    //=== 5.) คืนค่าผลลัพธ์
    return res.send(JSON.stringify({
      doc: docFind,
      isLoad:true ,
      class:"green", 
      msg: msg,
      userId: user.userId, // ส่งกลับไปตรวจสอบว่าจะทำอะไรกับฟอร์ม
      userAuthority: user.userAuthority, // ส่งกลับไปตรวจสอบว่าจะทำอะไรกับฟอร์ม
    }))
  }catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isLoad: false ,
      class:"red", 
      msg:err.message
    }))
  }finally{
    client.close()
  }
})



//=============================================
// 
router.post(PATH_CHANGES_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)

  //=== 0.1) จับประเภทเอกสาร
  const { docId } = req.body

  //=== 
  const user = await myUsers.getUserData(req)
  await myDocMain.getMainDocPathObj(req, res, user.userAuthority)

  //=== 0.2) จับชื่อ collection ตาม docTitle
  const { collectionName } = myData.get_Info_ByUrl(req.originalUrl)

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(collectionName)

    //=== 1.) ค้นหาเอกสาร (ถ้ามี docId)
    var docFind = await collection.findOne({ docId : docId })
    if(!docFind){
      return res.send(JSON.stringify({
        isPrint: false ,
        class:"red", 
        msg:`ไม่พบเอกสารเลขที่ "${docId}"`
      }))
    }
    // console.log("docFind ===> ", docFind)

    //=== 2.) จับเฉพาะค่า changesHistory จาก docFind
    const changesHistory = docFind.changesHistory || []

    //=== 3.) ตรวจสอบประวัติการเปลี่ยนแปลง
    if(changesHistory.length < 1){
      return res.send(JSON.stringify({
        isPrint: false ,
        class:"yellow", 
        msg:`ไม่พบประวัติการเปลี่ยนแปลง`
      }))
    }

    //=== 3.) สร้าง HTML จาก template
    const templatePath = path.join(folderForms, 'doc_changes.ejs')
    const htmlPage =  await myModule.renderView(templatePath, res, {
      title: docFind.docId,
      time: DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm'),
      changesHistory : changesHistory,
    });

    //=== 4.) ส่ง HTML กลับไป
    res.send(JSON.stringify({
      isPrint:true,
      class:"green",
      htmlPage:htmlPage
    }))
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({ isPrint:false, class:"red", msg:err.message}))
  } finally {
    client.close();
  } 
})



//=============================================
// 
router.post(PATH_PRINT_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)

  //=== 0) จับค่าจาก request body
  const { docId, action } = req.body

  //=== 0.1) 
  const user = await myUsers.getUserData(req)
  await myDocMain.getMainDocPathObj(req, res, user.userAuthority)

  //=== 0.2) จับชื่อ collection ตาม docTitle
  const {collectionName, docTitle} = myData.get_Info_ByUrl(req.originalUrl)

  const client = new MongoClient(global.dbUrl)
  try {
    //=== 2.)
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(collectionName)
    
    //=== 3.) ถ้ามีค้นหาเอกสาร (ถ้ามี docId)
    // - ให้คนหาเอกสารแล้วส่งไปด้วย
    var docFind = await collection.findOne({ docId : docId })
    if(!docFind){
      return res.send(JSON.stringify({
        isLoad: false ,
        class:"red", 
        msg:`ไม่พบเอกสารเลขที่ "${docId}"`
      }))
    }

    // console.log("docFind ===> ", docFind)
    
    //=== 4.) จับค่าต่างๆส่งไป
    docFind.docTitle = docTitle
    docFind.statusName = myData.get_StatusName_byStatusNumber(docFind.docStatusNumber)
    
    //=== 6.) แปลงตัวเลขสำหรับแสดงผลการพิมพ์
    const docFindAdjust = myData.convert_DocPrint(docFind);

    //=== 7.) สร้าง HTML จาก template ใช้กับทั้ง Print/PDF/Image
    const templatePath = path.join(folderForms, 'doc_print.ejs')
    const htmlPage = await myModule.renderView(templatePath, res, {
      title: docId,
      time: myDateTime.getDate(0), // myDateTime.formatDate(new Date()),
      action: action,
      doc: docFindAdjust,
      ...await myModule.getSettings()
    });

    //=== 8.) เลือกประเภทการดาวน์โหลด/พิมพ์
    if(action == 'print'){      
      res.send(JSON.stringify({
        isPrint:true,
        class:"green",
        htmlPage:htmlPage // ส่ง HTML กลับไป
      }))
    }else if(action == 'image'){
      // console.log("Generating image...");
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(htmlPage, { waitUntil: "networkidle0", timeout:10000 })
      // รอ 1 วินาที เพื่อให้ฟอนต์และ resource โหลดครบ
      await new Promise(resolve => setTimeout(resolve, 1000));

      const widthMm = 80;
      const widthPixels = Math.floor(widthMm / 25.4 * 96); // 96 DPI
      await page.setViewport({
        width: widthPixels,
        height: 600, // ตั้งต้นไว้ก่อน เดี๋ยวค่อยคำนวณจริง
        deviceScaleFactor: 1,
      });

      // คำนวณความสูงเนื้อหา (content height)
      const contentHeight = await page.evaluate(() => {
        // ใช้ body หรือ html แล้วแต่ layout
        const body = document.body;
        const html = document.documentElement;
        return Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        );
      });

      // Screenshot เฉพาะขนาด 80mm x contentHeight
      const screenshotBuffer = await page.screenshot({
        type: "jpeg",
        clip: {
          x: 0,
          y: 0,
          width: widthPixels,
          height: contentHeight
        },
        omitBackground: false,
      });
      await browser.close();

      //=== Send the image as a response
      const filename = docFind.docId.replace(/\//g, '')
      // console.log("Generated image for document:", filename);

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename=${filename}.jpeg`,
        'Content-Length': screenshotBuffer.length,
      });
      res.end(screenshotBuffer);
    }
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({ isPrint:false, class:"red", msg:err.message}))
  } finally {
    client.close();
  } 
})






//=======================================================
// สำหรับเซ็ตสถานะเอกสารอย่างเดียว
// 
router.post(PATH_STATUS_ARR , mainAuth.isAuth , async (req,res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)
  // { docId: 'WI2509-00007', docStatusNumber: '1', action: 'cancel' }

  const client = new MongoClient(global.dbUrl);  
  try{   

    //=== 0.1) 
    const user = await myUsers.getUserData(req)
    await myDocMain.getMainDocPathObj(req, res, user.userAuthority)

    //=== 0.2) จับชื่อ collection
    const { collectionName } = myData.get_Info_ByUrl(req.originalUrl)
    const { docId, action } = req.body
    const text = action == 'cancel' ? 'ยกเลิก' : action == 'finish' ? 'จบ' : ''

    //=== 1.) ต้องมี docId และ action ตามกำหนด
    if(!docId || !['finish','cancel'].includes(action)){
      return res.send(JSON.stringify({
        isStatus: false,
        class: "red",
        msg: "เลขที่เอกสารไม่ถูกต้อง หรือ action ไม่ถูกต้อง"
      }));
    }

    //= เงื่อนไขการค้นหา - เฉพาะของตนเองเท่านั้น
    const matchConditions = { docId: docId, userId: user.userId }

    //=== 3) ค้นหา docId ก่อน - ไม่พบตีกลับ
    const db = client.db(global.dbName)
    const collection = db.collection(collectionName)
    const findDoc = await collection.findOne(matchConditions);
    if (!findDoc) {
      return res.send(JSON.stringify({
        isStatus: false,
        class: "red",
        msg: `ไม่พบเอกสาร "${docId}{{sep}}หรือไม่มีสิทธิ์${text}เอกสารที่ตันเองไม่ได้สร้าง`
      }));
    }
    // console.log('3.) findDoc :', findDoc);

    // ถ้าพบเอกสาร - docStatusNumber จับจากเอกสารที่พบดีกว่า
    const docStatusNumber = findDoc.docStatusNumber

    //=== 4.) สถานะเอกสารต้องเป็น 1/2 เท่านั้น จึงจะยกเลิกได้
    if(action === 'cancel' && !(docStatusNumber == 1 || docStatusNumber == 2)) {
      return res.send(JSON.stringify({
        isStatus: false,
        class: "red",
        msg: "ไม่สามารถยกเลิกเอกสาร ที่ไม่อยู่ในสถานะ 1 หรือ 2 ได้"
      }));
    } else if(action === 'finish' && !docStatusNumber == 1) {
      return res.send(JSON.stringify({
        isStatus: false,
        class: "red",
        msg: "ไม่สามารถจบเอกสาร ที่ไม่อยู่ในสถานะ 1 ได้"
      }));
    }

    //=== 5.) ตรวจสอบค่า canCancel
    if(action == 'cancel'){
      //== ตรวจสอบค่า canCancel ก่อน
      if(findDoc.canCancel == false){
        return res.send(JSON.stringify({
          isStatus: false,
          class: "red",
          msg: `เอกสาร "${docId}" เอกสารเกินกำหนดยกเลิกแล้ว`
        }));
      }
      //===
      const checkobj = await myData.check_DocDateTime_CanCancel(findDoc, collectionName, user.userId)
      if(checkobj.canCancel == false){
        return res.send(JSON.stringify({
          isStatus: false,
          class: "red",
          msg: `เอกสาร "${docId}" เอกสารเกินกำหนดยกเลิกแล้ว`
        }));
      }
    }

    //=== 6.) อัปเดทสถานะเอกสารเป็น new_docStatusNumber
    if(action == 'cancel'){
      var new_docStatusNumber = 10
    }else if(action == 'finish'){
      var new_docStatusNumber = 2
    }
    const rtn = await collection.updateOne(
      matchConditions , 
      { $set: { docStatusNumber: new_docStatusNumber } }
    );
    // console.log('6.) rtn :', rtn);

    //=== 7.) บันทึกประวัติการเปลี่ยนแปลงด้วย
    var msg =  `${text} "${docId}" เรียบร้อยแล้ว`
    if(rtn.matchedCount || rtn.modifiedCount > 0){
      // จับความแตกต่างของ docStatusNumber ก็พอ
      const changes = myData.getChangeHistory(
        { docStatusNumber: docStatusNumber}, // เก่า
        { docStatusNumber : new_docStatusNumber }
      ); // ใหม่

      if(changes.length > 0){
        const changeHistoryObj = {
          dateTime : DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm'),
          userId : user.userId ,
          userFullname : user.userFullname ,
          changes : changes,
        }
        //== Update History - เพิ่มข้อมูลการอัปเดท **** 
        await collection.updateOne(
          { docId: docId },          
          // ไว้ตำแหน่งแรก - แก้ไขที่หลังอยู่บนสุด 
          { $push: { changesHistory: { $each: [changeHistoryObj], $position: 0 } } }
        )
        msg += `{{sep}}[บันทึกการแก้ไข]`
      }

      return res.send(JSON.stringify({
        isStatus: true,
        docId: docId,
        docStatusNumber: new_docStatusNumber,
        class: "green",
        msg: msg
      }));
    }else if(rtn.matchedCount && rtn.modifiedCount < 1){
      return res.send(JSON.stringify({
        isStatus: false,
        docId: docId,
        docStatusNumber: docStatusNumber, // ส่งของเดิมกลับไป
        class: "yellow",
        msg: `"${docId} ไม่เปลี่ยนแปลง"`
      }));
    }
  }catch(err){
    console.log(err)
    res.send(JSON.stringify({
      isStatus: false ,
      class:"red", 
      msg:err.message
    }))
  }finally{
    client.close()
  }
})




export default router






// //=== 2.) O,S สามารถจบของ A,U ได้
// // - แต่ยกเลิกตั้งของใครของมัน 
// if(action == 'finish'){ // O,S สามารถจบของ A,U ได้ด้วย 
//   if(['O','S'].includes( user.userAuthority )){ // O,S
//     var matchConditions = { docId: docId }
//   }else{  // A,U จบได้เฉพาะของตนเอง
//     var matchConditions = { docId: docId, userId: user.userId }
//   }
// }else{ // ยกเลิกได้เฉพาะของตนเองเท่านั้น
//   var matchConditions = { docId: docId, userId: user.userId }
// }
// console.log('matchConditions :', matchConditions);




// //=============================================
// //
// router.post(PATH_LOAD_ARR, mainAuth.isAuth, async (req, res) => {  
//   // console.log(`-----------------${req.originalUrl}------------------`) 
//   // console.log(req.body)

//   //=== 0.1) docId ที่จะโหลดเอกสาร ต้องส่งมาเสมอ 
//   let { docId } = req.body 

//   //===0.2) ค้นหาได้เฉพาะของตนเองเท่านั้น ยกเว้น O และ A
//   // let { 
//   //   userId:userId_session, 
//   //   userAuthority: userAuthority_session 
//   // } = myUsers.getSessionData(req)
//   const user = await myUsers.getUserData(req)
//   await myDocMain.getMainDocPathObj(req, res, user.userAuthority)

//   //=== 0.3) จับชื่อฐานข้อมูล
//   const {collectionName} = myData.get_Info_ByUrl(req.originalUrl)
//   // console.log('collectionName :', collectionName);

//   const client = new MongoClient(global.dbUrl)
//   try{
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(collectionName)

//     //=== 1.) โหลดเอกสารตาม docId 
//     // - ถ้าไม่ใช่ O/S โหลดได้เฉพาะของตนเอง ( A/U โหลดได้เฉพาะของตนเอง )
//     let query = { docId:docId }
//     if (!['O','S'].includes(user.userAuthority)) { 
//       query.userId = user.userId
//     }
//     var docFind = await collection.findOne( 
//       query ,
//       { projection: { _id:0, changesHistory:0 }  } // ไม่เอา changesHistory
//     )
    
//     //=== 2.) ไม่พบ
//     if(!docFind){
//       return res.send(JSON.stringify({
//         isLoad: false ,
//         class:"red", 
//         msg:`ไม่พบเอกสารเลขที่ "${docId}"`
//       }))
//     }

//     //=== 3.) เปรียบเทียบว่าปัจจุบัน ว่ามากกว่า dateTimeCanEdit หรือไม่ 
//     // - ถ้าเกินแล้วให้สแตมป์ docStatusNumber เป็น 2[จบ] ****
//     let msg = `โหลดเอกสารเลขที่ "${docId}" {{sep}}เรียบร้อยแล้ว`
//     if(docFind.docStatusNumber == 1 && docFind.dateTimeCanEdit){
//       let checkObj  = await myData.check_DocDateTime_CanEdit(docFind, collectionName, user.userId);
//       docFind.dateTimeEditRemain = checkObj.dateTimeEditRemain
//       if(checkObj.canEdit == false){
//         docFind.docStatusNumber = checkObj.docStatusNumber
//         msg += '{{sep}}[ เลยกำหนดแก้ไข สถานะถูก{{sep}}เปลี่ยนเป็น 2 อัตโนมัติ]'
//       }
//     }else{
//       docFind.dateTimeEditRemain = '-'
//     }
//     if( (docFind.docStatusNumber == 1 || docFind.docStatusNumber == 2) && docFind.dateTimeCanCancel){
//       const checkObj = await myData.check_DocDateTime_CanCancel(docFind, collectionName, user.userId)
//       docFind.dateTimeCancelRemain = checkObj.dateTimeCancelRemain;
//       if(checkObj.canCancel == false){
//         msg += '{{sep}}[ เลยกำหนดยกเลิกเอกสารแล้ว ]'
//       }
//     }else{
//       docFind.dateTimeCancelRemain = '-'
//     }

//     // - branchName - ต้องส่งไปด้วยตอนโหลด เพราะใช้ชื่อปัจจบันจากฐานข้อมูล
//     const { branchName } = await myData.getUserBranchesById(docFind.branchId)
//     docFind.branchName = branchName 

//     //=== 5.) คืนค่าผลลัพธ์
//     return res.send(JSON.stringify({
//       doc: docFind,
//       isLoad:true ,
//       class:"green", 
//       msg: msg,
//     }))
//   }catch(err){
//     console.log(err)
//     return res.send(JSON.stringify({
//       isLoad: false ,
//       class:"red", 
//       msg:err.message
//     }))
//   }finally{
//     client.close()
//   }
// })

// //=============================================
// //
// router.get(PATH_LOAD_LAST_ARR, mainAuth.isAuth, async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log(req.body)

//   //===0.2) ค้นหาได้เฉพาะของตนเองเท่านั้น ยกเว้น O และ A
//   const user = await myUsers.getUserData(req)
//   await myDocMain.getMainDocPathObj(req, res, user.userAuthority)
 
//   //=== 0.3) จับชื่อฐานข้อมูล
//   const {collectionName} = myData.get_Info_ByUrl(req.originalUrl)
//   console.log('collectionName :', collectionName);

//   const client = new MongoClient(global.dbUrl)
//   try{
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(collectionName)

//     //=== 1.) โหลดเอกสารตัวสุดท้าย (เรียงตาม _id ล่าสุด)
//     var docFind = await collection.findOne(
//       { userId: user.userId } ,  // กรองเฉพาะของตนเอง
//       { 
//         sort: { _id: -1 },
//         projection: { _id:0, changesHistory:0 }
//       }
//     );
    
//     //=== 2.) ไม่พบ - ถ้าไม่เคยสร้างจะไม่พบ
//     if(!docFind){
//       return res.send(JSON.stringify({
//         isLoad: false ,
//         class:"red", 
//         msg:`ไม่พบเอกสารล่าสุด`
//       }))
//     }

//     //=== 3.) เปรียบเทียบว่าปัจจุบัน ว่ามากกว่า dateTimeCanEdit หรือไม่ 
//     // - ถ้าเกินแล้ว จะไม่สามารถลบเอกสารได้ + 
//     //   สแตมป์ docStatusNumber เป็น 2[จบ]
//     let msg = `โหลดเอกสารเลขที่ "${docFind.docId}"{{sep}}เรียบร้อยแล้ว{{sep}}[เอกสารล่าสุดของคุณ]`
//     if(docFind.docStatusNumber == 1 && docFind.dateTimeCanEdit){
//       let checkObj  = await myData.check_DocDateTime_CanEdit(docFind, collectionName, user.userId);
//       docFind.dateTimeEditRemain = checkObj.dateTimeEditRemain
//       if(checkObj.canEdit == false){
//         docFind.docStatusNumber = checkObj.docStatusNumber
//         msg += '{{sep}}[ เลยกำหนดแก้ไข สถานะถูก{{sep}}เปลี่ยนเป็น 2 อัตโนมัติ]'
//       }
//     }else{
//       docFind.dateTimeEditRemain = '-'
//     }
//     if( (docFind.docStatusNumber == 1 || docFind.docStatusNumber == 2) && docFind.dateTimeCanCancel){
//       const checkObj = await myData.check_DocDateTime_CanCancel(docFind, collectionName, user.userId)
//       docFind.dateTimeCancelRemain = checkObj.dateTimeCancelRemain;
//       if(checkObj.canCancel == false){
//         msg += '{{sep}}[ เลยกำหนดยกเลิกเอกสารแล้ว ]'
//       }
//     }else{
//       docFind.dateTimeCancelRemain = '-'
//     }
//     // console.log('docFind :', docFind);

//     // - branchName - ต้องส่งไปด้วยตอนโหลด เพราะใช้ชื่อปัจจบันจากฐานข้อมูล
//     const { branchName } = await myData.getUserBranchesById(docFind.branchId)
//     docFind.branchName = branchName 

//     //=== 5.) คืนค่าผลลัพธ์
//     return res.send(JSON.stringify({
//       doc: docFind,
//       isLoad:true ,
//       class:"green", 
//       msg: msg,
//     }))
//   }catch(err){
//     console.log(err)
//     return res.send(JSON.stringify({
//       isLoad: false ,
//       class:"red", 
//       msg:err.message
//     }))
//   }finally{
//     client.close()
//   }
// })