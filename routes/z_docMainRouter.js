// import ejs from 'ejs'
// import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import express from 'express'
const router = express.Router()
import { MongoClient } from 'mongodb'
import * as myDateTime from "../mymodule/myDateTime.js"
import * as myUsers from "../mymodule/myUsers.js"
import * as myModule from "../mymodule/myModule.js"
import * as myData from "../mymodule/myData.js"
import * as myDocMain from "../mymodule/myDocMain.js"
import mainAuth from "../middleware/mainAuth.js"
import { DateTime } from 'luxon' // import * as luxon from 'luxon'
//=== 
const WAREHOUSE_IN = global.PATH_WAREHOUSE_IN
const WAREHOUSE_OUT = global.PATH_WAREHOUSE_OUT
const SALES = global.PATH_SALES
const PATH_MAIN_ARR = [WAREHOUSE_IN, WAREHOUSE_OUT, SALES]
const PATH_SAVE_ARR = [`${WAREHOUSE_IN}/save`, `${WAREHOUSE_OUT}/save`, `${SALES}/save`]
const PATH_VIEW_IMAGE_ARR = [`${WAREHOUSE_IN}/view-image`, `${WAREHOUSE_OUT}/view-image`]


//================================================================
// ยังติดเรื่องสิทธิ์ U เข้าไม่ได้ ถ้าเป็น warehouse แต่เข้าได้ถ้าเป็น sales
//
router.get(PATH_MAIN_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)

  //=== query string สำหรับโหลดและค้นหาเอกสาร เมื่อโหลดหน้าเว็บ
  const { docId:DOC_ID, sip:SIP } = req.query  
  try{
    //=== จับข้อมูลยูสเซอร์จากฐานข้อมูลทุกครั้ง - เพื่อระบุสาขาปัจจุบันเสมอ
    const user = await myUsers.getUserData(req)
    const pathObj = await myDocMain.getMainDocPathObj(req,res, user.userAuthority)
    // console.log("pathObj ===> ", pathObj)

    const html = await myModule.renderView('docMain', res, {
      title: pathObj.PAGE,
      time: DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd'),
      msg: req.flash('msg'),

      user : user , //=== จับข้อมูลยูสเซอร์จากฐานข้อมูลทุกครั้ง - เพื่อระบุสาขาปัจจุบันเสมอ
      ...await myModule.getSettings(),
      ...pathObj,
      
      DOC_STATUS_TITLE: global.DOC_STATUS_TITLE,
      DOC_ID, // กรณีต้องการโหลดเอกสารเลย
      SIP,    // กรณีต้องการค้นหาเอกสารเลย
    })
    res.send(html)
  }catch(err){
    console.log(err.message)
    res.status(404).sendFile(file404)
  }
})



//================================================================
// 
// 
router.post(PATH_SAVE_ARR, mainAuth.isAuth , async (req,res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log(req.body)

  //=== ตรวจสอบสิทธิ์ตรงนี้ได้
  await myDocMain.getMainDocPathObj(req,res)

  const client = new MongoClient(global.dbUrl);  
  await client.connect()
  try{
    
    //=== 0.1) เฉพาะของตนเองเท่านั้น
    const user = await myUsers.getUserData(req)

    //=== 0.2) แก้ type ข้อมูลเป็นตัวเลข
    req.body = myData.convert_DataType(req.body)

    //=== 0.3) แยกเขียนไฟล์ภาพ ถ้ามีการอัปโหลดมาด้วย 
    // - มีเฉพาะใน warehouse-in/warehouse-out ***
    if(req.body.refImageBase64){
      var refImageBase64 = req.body.refImageBase64 ? req.body.refImageBase64 : null
      delete req.body.refImageBase64
    }

    //=== 0.4) จับข้อมูลที่ใช้เสมอ docStatusNumber/docId
    const docStatusNumber = req.body.docStatusNumber ? Number(req.body.docStatusNumber) :  req.body.docStatusNumber
    const docId = req.body.docId

    // console.log("docStatusNumber ===> ", docStatusNumber)
    // console.log("docId ===> ", docId)
    
    //=== 0.5) ฐานข้อมูล
    const { collectionName, docType, hoursCanEdit, hoursCanCancel } = myData.get_Info_ByUrl(req.originalUrl)
    const db = client.db(global.dbName)
    const collection = db.collection(collectionName)

    //=== 1.) ถ้าไม่มี docStatusNumber จะต้องสร้างใหม่ ===================
    if(!docStatusNumber && !docId){ // สร้างใหม่ - เขียน req.body ลงไป 

      //== 1.1) คำนวณ docId ใหม่ 
      // จากข้อมูลใน coll_quotation ฟิลด์ docId 
      // ใช้รูปแบบ  yy/MM-000000 ถ้าไม่มีข้อมูลยใช้ yy/MM-000001
      // จับข้อมูลตัวสุดท้าย หลังจากเรียงลำดับตาม docId
      const lastDoc = await collection.find().sort({ _id: -1 }).limit(1).toArray();
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      if(docType == 'warehouseIn') {
        var prefix = `WI${currentYear}${currentMonth}`;
      } else if(docType == 'warehouseOut') {
        var prefix = `WO${currentYear}${currentMonth}`;
      } else if(docType == 'sales') {
        var prefix = `S${currentYear}${currentMonth}`;
      }
      let newDocId = `${prefix}-00001`;
      if (lastDoc.length > 0) {
        const lastDocId = lastDoc[0].docId;
        const lastDocIdNumber = Number(lastDocId.split('-')[1]) ;
        newDocId = `${prefix}-${String(lastDocIdNumber + 1).padStart(5, '0')}`;
      }
      req.body.docId = newDocId;
      req.body.docStatusNumber = 1; // สถานะเอกสารเป็น 'สร้าง'


      //=== ใส่วันที่เอกสาร
      const docDateTime = DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm')
      req.body.docDateTime = docDateTime

      //== 1.2) บันทึกรูปภาพถ้ามี - และเขียนชื่อไฟล์ลง req.body.refImage
      if(refImageBase64){
        const base64Data = refImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${newDocId}.jpg`;
        const {folderName} = myData.get_Info_ByUrl(req.originalUrl);
        const filePath = path.join(folderName, fileName);
        // Convert and save as .jpg using sharp
        await sharp(buffer)
              .resize({ height: 1000, withoutEnlargement: true })
              .jpeg({ quality: 90 })
              .toFile(filePath);
        req.body.refImage = fileName;
        // }else{ req.body.refImage = null }
      }
      
      //= 1.2) Stamp วันเวลาสำหรับแก้ไข - เฉพาะ new เท่านั้น
      req.body.dateTimeCanEdit = myDateTime.getDateTime( hoursCanEdit * 60);
      req.body.dateTimeCanCancel =  myDateTime.getDateTime( hoursCanCancel * 60);

      //== 1.4) เขียน req.body ลงไปใน coll_quotation
      await collection.insertOne(req.body);

      //== 1.5) คืนค่าผลลัพธ์
      return res.send(JSON.stringify({
        isSave: true,
        class: "green",
        msg: `สร้างเอกสารใหม่ ${newDocId}{{sep}}เรียบร้อยแล้ว`,
        doc : req.body, // คืนทั้งยวง
      }));
    }
    //=== 2.) ถ้า docStatusNumber เป็น 1 -  อัปเดท ===================
    else if(docStatusNumber == 1 && docId){

      //== 2.0) U - แก้ไขไม่ได้ - ให้ยกเลิกแล้วทำใหม่
      if(user.userAuthority == 'U'){
        return res.send(JSON.stringify({
          isSave: false,
          class: "red",
          msg: "ไม่สามารถแก้ไขเอกสารนี้ได้{{sep}}หากต้องการแก้ไข{{sep}}กรุณายกเลิกเอกสารนี้แล้วสร้างใหม่"
        }));
      }

      //== 2.1) ค้นหา docId ก่อน - ไม่พบตีกลับ
      const docFind = await collection.findOne({ 
        docId : docId, 
        userId : user.userId 
      });
      if (!docFind) {
        return res.send(JSON.stringify({
          isSave: false,
          class: "red",
          msg: "ไม่พบเอกสารที่ต้องการอัปเดท หรือ{{sep}}ไม่สามารถบันทึกเอกสารที่ตนเองไม่ได้สร้าง"
        }));
      }

      //== 2.2) ตรวจสอบสถานะเอกสารอีกครั้ง *** เพราะมีการเปลี่ยนสถานะอัตโนัมติได้
      if (docFind.docStatusNumber != 1 ) {
        return res.send(JSON.stringify({
          isSave: false,
          class: "red",
          msg: "ไม่สามารถอัปเดทเอกสารได้{{sep}}เนื่องจากสถานะเอกสารไม่ใช่ 1 แล้ว"
        }));
      }


      //=== 2.3) ตรวจสอบเวลาแก้ไขและยกเลิก
      // - เปรียบเทียบว่าปัจจุบัน ว่ามากกว่า dateTimeCanEdit หรือไม่ 
      // - ถ้าเกินแล้วให้สแตมป์ docStatusNumber เป็น 2[จบ] ****
      if(docFind.docStatusNumber == 1 && docFind.dateTimeCanEdit){
        let checkObj  = await myData.check_DocDateTime_CanEdit(docFind, collectionName, user.userId);
        docFind.dateTimeEditRemain = checkObj.dateTimeEditRemain // เผื่อมีการแก้ไขเวลาที่เซ็ตไว้
        if(checkObj.canEdit == false){
          docFind.docStatusNumber = checkObj.docStatusNumber
          return res.send(JSON.stringify({
            isSave: false,
            doc : docFind,
            class: "red",
            msg: 'เลยกำหนดแก้ไข สถานะถูก{{sep}}เปลี่ยนเป็น 2 อัตโนมัติ'
          }));
        }
      }
      if( (docFind.docStatusNumber == 1 || docFind.docStatusNumber == 2) && docFind.dateTimeCanCancel){
        const checkObj = await myData.check_DocDateTime_CanCancel(docFind, collectionName, user.userId)
        docFind.dateTimeCancelRemain = checkObj.dateTimeCancelRemain // เผื่อมีการแก้ไขเวลาที่เซ็ตไว้
        if(checkObj.canCancel == false){
          return res.send(JSON.stringify({
            isSave: false,
            doc : docFind,
            class: "red",
            msg: `ไม่สามารถบันทึกเอกสารได้{{sep}}เนื่องจากเลยกำหนดยกเลิกเอกสารแล้ว`
          }));
        }
      }
      
      //== 2.2) บันทึกรูปภาพถ้ามี - และเขียนชื่อไฟล์ลง req.body.refImage
      if(refImageBase64){
        const base64Data = refImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${docFind.docId}.jpg`;
        const {folderName} = myData.get_Info_ByUrl(req.originalUrl);
        const filePath = path.join(folderName, fileName);
        await sharp(buffer)
              .resize({ height: 1000, withoutEnlargement: true })
              .jpeg({ quality: 90 })
              .toFile(filePath);
        req.body.refImage = fileName;
      } // อาจมีของเดิมอยู่แล้ว ไม่ต้องเซ็ทกลับเป็น null
      
      //== 2.3) พบ docId - อัปเดท
      const rtn = await collection.updateOne(
        { 
          docId: docId, 
          userId : user.userId // เฉพาะของตนเองเท่านั้น - ไม่ว่าจะเป็น O หรือไม่
        },
        { $set: req.body }
      );

      //== 2.3) ตรวจสอบผลลัพธ์
      if(rtn.modifiedCount > 0){

        //= 2.3.1) เก็บ changes
        const changes = myData.getChangeHistory(docFind, req.body);
        //= 2.3.2) ถ้ามี changes
        if(changes.length > 0){
          const changeHistoryObj = {
            dateTime : DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm'),
            userId : user.userId ,
            userFullname : user.userFullname ,
            changes : changes,
          }
          //=== Update History - เพิ่มข้อมูลการอัปเดท
          await collection.updateOne(
            { docId: docId },          
            // { $push: { changesHistory : changeHistoryObj }  }
            // ไว้ตำแหน่งแรก - แก้ไขที่หลังอยู่บนสุด 
            { $push: { changesHistory: { $each: [changeHistoryObj], $position: 0 } } }
          ) 
          return res.send(JSON.stringify({
            doc : req.body, // คืน req.body ที่อัปเดทแล้ว
            isSave: true,
            class: "green",
            msg: `อัปเดท ${docId} เรียบร้อยแล้ว{{sep}}[บันทึกการแก้ไข]`
          }));
        }
        //= 2.3.3) ถ้าไม่มี changes
        else{
          return res.send(JSON.stringify({
            doc : req.body, // คืน req.body ที่อัปเดทแล้ว
            isSave: true,
            class: "green",
            msg: `อัปเดท ${docId} เรียบร้อยแล้ว`
          }));
        }

      }else if(rtn.acknowledged && rtn.modifiedCount < 1){
        return res.send(JSON.stringify({
          doc : req.body, // คืน req.body ที่อัปเดทแล้ว
          isSave: false,
          class: "yellow",
          msg: `"${docId}" ไม่มีการเปลี่ยนแปลงข้อมูล`
        }));
      }
    }
    //=== 3.) ถ้า docStatusNumber เป็น 2 ===================
    else if( (docStatusNumber == 2 || docStatusNumber == 10) && docId){ 
      return res.send(JSON.stringify({
        isSave: false,
        class: "red",
        msg: `ไม่สามารถบันทึกเอกสาร สถานะ ${docStatusNumber} ได้`
      }));
    }else{
      return res.send(JSON.stringify({
        isSave: false,
        class: "red",
        msg: "สถานะเอกสารผิดผลาด"
      }));
    }
  }catch(err){
    console.log(err)
    res.send(JSON.stringify({
      isSave: false ,
      class:"red", 
      msg:err.message
    }))
  }finally{
    client.close()
  }
})




//======================================================
// ใช้ดูภาพ RefImage
// 
router.post(PATH_VIEW_IMAGE_ARR, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.body)

  const { filename } = req.body
  if(!filename){
    return res.status(400).send('ไม่พบไฟล์รูปภาพ')
  }

  //=== ฐานข้อมูล
  const {folderName} = myData.get_Info_ByUrl(req.originalUrl)
  const imagePath = path.join(folderName, filename)
  // imagePath ===>  D:\aWK_LeaseSystem\MPOS\warehouse-in\WI2509-00001.jpg

  const fileExtension = path.extname(filename).toLowerCase()
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}
  fs.readFile(imagePath, (err, data) => {
    if (err) {
      console.error('Error reading image:', err)
      return res.status(500).send('เกิดข้อผิดพลาดในการดึงรูปภาพ')
    }
    const contentType = mimeTypes[fileExtension] || 'application/octet-stream' 
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
})




export default router











