/* import XLSX from "xlsx" */
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient, ObjectId } from 'mongodb'
import ejs from 'ejs'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import sharp from 'sharp'
import { DateTime } from 'luxon'
import * as myDateTime from "../mymodule/myDateTime.js"
import * as myUsers from "../mymodule/myUsers.js"
import * as myModule from "../mymodule/myModule.js"
import * as myData from "../mymodule/myData.js"
import mainAuth from "../middleware/mainAuth.js"
const PATH_MAIN = '/items'
const PATH_SAVE = `${PATH_MAIN}/save`
const PATH_LOAD = `${PATH_MAIN}/load`
const PATH_DELETE = `${PATH_MAIN}/delete`
const PATH_VIEW = `${PATH_MAIN}/view`
const PATH_PRINT = `${PATH_MAIN}/print`
const PATH_FETCH = `${PATH_MAIN}/fetch`
const PREFIX = PATH_MAIN.replace(/\//g,"_") 
// ใช้ตอน warehouse
const PATH_FETCH_IMAGE = `${PATH_MAIN}/fetch-image`

//================================================================
// หน้า items 
// 
router.get(PATH_MAIN, mainAuth.isOS , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)

  //=== 0.) คำค้นหา - การแบ่งหน้า
  const sip = req.query.sip?.toString().replace(/[!@#$%^&*\///]/g, '')??''
  const scid = req.query.scid ? Number(req.query.scid) : null  // ค้นหาตาม categoryId
  const sis = req.query.sis  // ค้นหาตาม itemStatus
  const rpp = Number(req.query.rpp) || 30
  var page = Number(req.query.page) || 1 // ประกาด้วย var เท่านั้น
  const loadId = req.query.loadId || ''  // สำหรับการโหลด 1 ตัว - ตัวนี้หมายถึง itemId

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const coll_items = db.collection(global.dbColl_items)    

    //=== 1.) สร้าง Object สำหรับ Projection
    const nowLocal = myDateTime.getDateTime() 
    const projectObj = { 
      _id: 1, 
      itemId: 1, 
      itemOnSale: 1,  // 
      itemPackageType: 1,  // 
      itemStock: 1, // 
      // itemSku: 1, // 
      itemName: 1,
      itemDesc: 1, 
      categoryId: 1,       
      itemStatus: 1, 
      itemUnit: 1,
      itemPrice: 1, 
      itemImage: 1, 
      itemRegisterDate: 1,
      itemRegisterDateTh: 1,
      itemsInSet: 1, // 
      canDelete: 1,  // มีตอนลบ จะสร้างตัวนี้มาให้ถ้าลบไม่ได้ 
      isCanDelete: {
        $cond: {
          if: {
            $gt: [
              {
                $dateDiff: {
                  startDate: { $toDate: nowLocal },
                  endDate: { $toDate: "$dateTimeCanDelete" },
                  unit: "minute"
                }
              },
              0
            ]
          },
          then: true,
          else: false
        }
      }
    }
    
    //=== 2.) ถ้ามีคำค้นหา - กรองเอกสารตามการค้นหา
    // - แต่ยังไม่ Slice หรือ Limit จำนวนเอกสาร
    // - เพื่อจะนับจำนวนเอกสารทั้งหมดก่อน เพราะต้องนำไปใช้ในการแบ่งหน้า pagination
    if (sip || scid || sis) {
      //== 2.0) สร้าง Aggregation Pipeline
      const agg = [
        { $project: projectObj },
        { $sort: { itemId : 1 } } ,        
      ]

      //== 2.1) ถ้ามีคำค้นหา(3จุด) ให้เพืพิ่ม $match 
      if (sip) {
        const regex = new RegExp(`.*${sip}.*`, 'i')
        agg.unshift(
          {
            $match: {
              $or: [
                { itemId:   { $regex: regex } },
                { itemName: { $regex: regex } },
              ]
            }
          }
        )
      } 
      if (scid) { agg.unshift({ $match : { categoryId: scid } }) }
      if (sis) { agg.unshift({ $match : { itemStatus: sis } }) }

      //== 2.2) ข้อมูลตามคำค้นหา
      var dataItemsBySearch = await coll_items.aggregate(agg).toArray()
      var totalDocs = dataItemsBySearch.length
      var pageNum = Math.ceil(totalDocs/rpp) 

      //== 2.3) ถ้ามีคำค้นหา กรองแล้วจำนวนหน้าอาจน้อยกว่า page ที่ส่งมา จึงต้องคำนวณใหม่
      if(page > pageNum){ // Active เป็นหน้าแรก
        var skipDocs = 0
        page = totalDocs > 0 ? 1 : 0
      }else{
        var skipDocs = Number((page-1)*rpp)
      }
      // var pageAct = Number(page) 

      //== 2.4) Slice หรือ Limit จำนวนเอกสาร
      var dataItems = dataItemsBySearch.slice(skipDocs, Number(skipDocs+rpp))
    }
    
    //=== 3) ไม่มีคำค้นหาใดๆ 
    else{ 
      var totalDocs = await coll_items.countDocuments({})
      const skipDocs = Number((page-1)*rpp)

      var dataItems = await coll_items.aggregate([
        { $project: projectObj } , 
        { $sort: { itemId : 1 } } ,
        { $skip: skipDocs } ,
        { $limit: rpp }
      ]).toArray()

      //=== สำหรับ pagination
      var pageNum = Math.ceil(totalDocs/rpp)
      // var pageAct = Number(page) 
    }


    //=== 4.) ถ้ามีไอเท็มที่จะโหลด - แต่อาจไม่เจอ เพราะถูกลบไปแล้ว 
    if (loadId) {

      //== 4.1) Lookup item 
      var itemToLoad = await coll_items.findOne(
        { itemId: loadId },
        { projection: projectObj }
      )

      //== 4.2) หา itemName สำหรับ itemsInSet โดยเอา itemIds ไป fine ใน coll_items
      // - itemsInSet ไม่ได้บันทึก itemName ไว้จึงต้องไปเอาจากคอลเล็กชั่น coll_items
      //
      if (itemToLoad && Array.isArray(itemToLoad.itemsInSet) && itemToLoad.itemsInSet.length > 0) {
        const itemIds = itemToLoad.itemsInSet.map(x => x.itemId);
        const foundItems = await coll_items.find(
          { itemId: { $in: itemIds } }, 
          { projection: { itemId: 1, itemName: 1, itemUnit: 1 } }
        ).toArray();
        itemToLoad.itemsInSet.forEach(obj => {
          const found = foundItems.find(x => x.itemId === obj.itemId);
          obj.itemName = found ? found.itemName : '';
          obj.itemUnit = found ? found.itemUnit : '';
        });
      }

      //== 4.3) ตรวจสอบภาพต่อ
      if(itemToLoad){
        //= 4.3.1) จับภาพเป็น base64
        if(itemToLoad.itemImage){
          const imagePath = path.join(folderItems, itemToLoad.itemImage)
          try {
            const imageBuffer = await fs.promises.readFile(imagePath)
            const mimeType = path.extname(itemToLoad.itemImage).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
            itemToLoad.itemImageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
          } catch (err) {
            console.log("Error reading image file:", err.message)
            itemToLoad.itemImageDataUrl = null
          }
        }
      }else{ // ไม่พบ item ในฐานข้อมูล
        var itemToLoad = {}
      }
    }else{ // ไม่มี loadId
      var itemToLoad = {}
    }

    //=== 5.) ตรวจสอบว่า itemToLoad เป็นอ็อบเจ็กต์ว่าง {}
    // - ถ้าว่าง ให้เอาค่าจาก req.flash('itemFlash') 
    //   ซึ่งจะมีมาหากในขั้นตอน save เกิด Error
    if (itemToLoad && Object.keys(itemToLoad).length === 0) {
      const itemFlash = req.flash('itemFlash') // flash เป็นอาเรย์
      if (itemFlash && itemFlash.length > 0) {
        itemToLoad = {...itemFlash[0]} || null;
      }
    }

    // //=== สำหรับ pop ชื่อ item
    // const itemNameUnique = await coll_items.distinct("itemName")
    // const ITEM_NAME_UNIQUE = JSON.stringify(itemNameUnique)
    //                              .replace(/\\/g, '\\\\')
    //                              .replace(/"/g, '\\"')

    //=== ใช้ pagination แบบ 5 ปุ่ม ต้องคำนวณหน้า                             
    const pagePre = Number(page ) - 1 < 1 ? "-" : Number(page) - 1
    const pageAct = Number(page)
    const pageNxt = Number(page) + 1 > pageNum ? "-" : Number(page) + 1

    //=== จับข้อมูลหมวดหมู่ - dbColl_itemsCategory
    const coll_itemsCategory = db.collection(global.dbColl_itemsCategory)
    const dataItemsCategory = await coll_itemsCategory.find({ categoryStatus: "active" }).toArray()

    //=== วนลูปเอา categoryName จาก dataItemsCategory ต่อ
    dataItems = dataItems.map(obj => {
      const categoryId = obj.categoryId
      const categoryName = dataItemsCategory.find( cat => cat.categoryId == categoryId)?.categoryName || "-"
      return { ...obj, categoryName } 
    })
    // console.log("--------------------")
    // console.log("dataItems ===> ", dataItems[0])
    // console.log("totalDocs ===> ", totalDocs)
    // console.log("page ===> ", page)
    // console.log("pageNum ===> ", pageNum)
    // console.log("pageAct ===> ", pageAct)


    const html = await myModule.renderView("items", res, {
      title: PAGE_ITEMS,
      time: DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd'),
      msg: req.flash('msg'),
      // ...myUsers.getSessionData(req),
      user : await myUsers.getUserData(req), //=== จับข้อมูลยูสเซอร์จากฐานข้อมูลทุกครั้ง - เพื่อระบุสาขาปัจจุบันเสมอ
      ...await myModule.getSettings(),

      //=== สำหรับ คำค้นหา
      loadId:loadId, // ส่งมาจากการ load หรือการ save 
      sip,
      scid,
      sis,

      //=== สำหรับ pagination
      rpp:rpp ,
      page:page ,
      pageAct:pageAct ,
      pageNum:pageNum ,
      pagePre:pagePre,
      pageNxt:pageNxt,
      pageLst:pageNum,
      totalDocs:totalDocs,
 
      PATH_MAIN,
      PATH_SAVE,
      PATH_LOAD,
      PATH_DELETE,
      PATH_VIEW,
      PATH_PRINT,
      PATH_FETCH,
      PREFIX,      

      dataItemsCategory,
      dataItems,
      item:itemToLoad,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }

})



//=======================================================
// save
// Multer configuration with dynamic destination
//================================================================
const upload = multer({ 
  storage: multer.diskStorage({
    destination: async function (req, file, cb) { // Make the destination function async
      try {
        await fs.promises.mkdir(folderItems, { recursive: true }); // Use async mkdir
        cb(null, folderItems);
      } catch (err) {
        cb(err); 
      }
    },
  
    filename: function (req, file, cb) {
      //=== ตั้งชื่อแบบส่มตัวเลข - ห้ามลบ 
      // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      // cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      const itemId = req.body.itemId
      const regex = new RegExp(ITEM_TYPE_PATTERN)
      if (!regex.test(itemId)) {
        cb(new Error('ไอดีไม่ถูกต้อง'))
      }else{
        //=== ตั้งชื่อตามไอดี
        const fileExtension = path.extname(file.originalname);
        const filename = `${itemId}${fileExtension}`; // Use _id as filename
        cb(null, filename);
      }
    },
  }) ,
  limits: { fileSize: 1024 * 1024 * 10 }, // จำกัด 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['.jpg', '.jpeg', '.png'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(fileExtension)) {
      cb(null, true)
    } else {
      cb(new Error('Only .jpg, .jpeg, and .png files are allowed!'))
    }
  },
}).single('itemImage')
//================================================================
// Centralized Error Handling Middleware
// 
const handleMulterError = async (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // console.error("Multer Error:", err.message);
    req.flash('msg', { class: "red", text: `Upload error: ${err.message}` });
    res.redirect(`${PATH_MAIN}`)
  } else if (err) { // An unknown error occurred.
    // console.error("Unknown Upload Error:", err);
    req.flash('msg', { class: "red", text: `Upload error: ${err.message}` });
    res.redirect(`${PATH_MAIN}`);
  } else { // No error, continue to the next middleware
    next() 
  }
}
//==== 
router.post(PATH_SAVE, [ 
    mainAuth.isOS ,        // 1
    ( req, res, next) => { // 2 - อัปโหลดไฟล์ (เขียนแบบนี้เพราะต้องการ handleMulterError)
      upload(req, res, async (err) => {
        if (err) {
          return handleMulterError(err, req, res, next)
        } // console.log(`req.file ===> : ${req.file}`);

        //=== resize ภาพต้นฉบับที่อัปโหลดมา ให้เลือก ขนาดกว้างไม่เกิน 600px สูงตามสัดส่วน และบันทึกเป็น .jpg เสมอ
        if (req.file) {
          const ext = path.extname(req.file.path);
          const base = path.basename(req.file.path, ext);
          const dir = path.dirname(req.file.path);
          const jpgPath = path.join(dir, `${base}.jpg`);
          // If input and output are the same, use a temp file
          let tempPath = jpgPath;
          if (req.file.path === jpgPath) {
            tempPath = path.join(dir, `${base}_temp.jpg`);
          }
          await sharp(req.file.path)
                .resize({ width: 600, withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .withMetadata({ density: 72 })
                .toFile(tempPath);
          await fs.promises.unlink(req.file.path);
          // If used a temp file, rename to final .jpg
          if (tempPath !== jpgPath) {
            await fs.promises.rename(tempPath, jpgPath);
          }
          // อัปเดต req.file ให้ชี้ไปที่ไฟล์ .jpg ใหม่
          req.file.path = jpgPath;
          req.file.filename = `${base}.jpg`;
        }

        //=== ทำภาพ thumbnail ขนาด 150x150px
        // Always use .jpg for thumbnail, regardless of original extension
        if (req.file) {
          const basename = path.basename(req.file.filename, path.extname(req.file.filename));
          const thumbFilename = `${basename}_thumb.jpg`;
          const thumbnailPath = path.join(folderItems, thumbFilename);
          await sharp(req.file.path)
                .resize({withoutEnlargement:true,height:150})
                .jpeg({ quality: 80 })
                .withMetadata({ density: 72 })
                .toFile(thumbnailPath);
        }

        next()
      })
    } 
  ], async (req,res) => {

  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)
  // console.log("req.file ===> ", req.file)


  const loadId = req.body.loadId // .toString().toUpperCase()
  const sip = req.body.sip?.toString().replace(/[!@#$%^&*\///]/g, '')??''
  const scid = req.body.scid
  const sis = req.body.sis
  const rpp = Number(req.body.rpp) || 30
  const page = Number(req.body.page) || 1
  
  //=== 
  const redirectUrl_error = `${PATH_MAIN}`
  const redirect_Url = `${PATH_MAIN}?`+
                       `sip=${sip}&scid=${scid}&sis=${sis}` +
                       `&rpp=${rpp}&page=${page}&loadId=${loadId}`

  const client = new MongoClient(global.dbUrl)
  try {    
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_items)

    //=== 3.) เตรียมข้อมูลที่จะ Save

    //== 3.1) แปลงวันที่
    const itemRegisterDateTh = req.body.itemRegisterDateTh
    if(itemRegisterDateTh && itemRegisterDateTh.split(' ').length === 3){
      var itemRegisterDate = myDateTime.format_ThaiDate_to_IsoDate(itemRegisterDateTh)
    }else{
      var itemRegisterDate = ''
    }

    //== 3.2) สร้าง itemsInSet
    const itemsInSet = []
    if (Array.isArray(req.body.itemIdInset)) {
      req.body.itemIdInset.forEach((id, index) => {
        itemsInSet.push({
          itemId: id,
          // itemName: req.body.itemNameInset[index], // หรือจะไป Lookup เอา ???
          itemAmount: req.body.itemAmountInset[index] ? Number(req.body.itemAmountInset[index]) : 0
        })
      })
    } else if (req.body.itemIdInset) { // กรณีมีไอเท็มเดียว
      itemsInSet.push({
        itemId: req.body.itemIdInset,
        // itemName: req.body.itemNameInset, // หรือจะไป Lookup เอา ???
        itemAmount: req.body.itemAmountInset ? Number(req.body.itemAmountInset) : 0
      })
    }

    //== 3.3) ข้อมูลที่จะ Save ทั้งหมด
    const itemId = req.body.itemId ? req.body.itemId.toString().toUpperCase() : req.body.itemId
    const itemData = {
      itemId: itemId ,
      itemPackageType: req.body.itemPackageType, // ***
      // itemSku: req.body.itemSku, // ***
      itemOnSale: req.body.itemOnSale, // ***
      itemStock: req.body.itemStock, // *** 
      categoryId: Number(req.body.categoryId), // ตัวเลข
      itemStatus: req.body.itemStatus,
      itemName: req.body.itemName,
      itemPrice: req.body.itemPrice ? Number(req.body.itemPrice) : 0, // ตัวเลข
      itemUnit: req.body.itemUnit,
      itemRegisterDate: itemRegisterDate,
      itemRegisterDateTh: itemRegisterDateTh,
      itemDesc: req.body.itemDesc,
      itemsInSet: itemsInSet 
      // itemImage: req.file.filename, // เอาออก - ไปเพิ่มทีหลัง (ชื่อไฟล์)
    }
    // console.log("itemId ===> ", itemId)
    // console.log("_id ===> ", _id)

    //=== 3.4) ถ้า itemPackageType จะต้องมี itemsInSet อย่างน้อย 1 ตัว
    if(itemData.itemPackageType === "set"){
      if(!itemData.itemsInSet || itemData.itemsInSet.length === 0){
        req.flash("msg", { class:"red", text: 'กรุณาเพิ่มรายการในชุด{{sep}}อย่างน้อย 1 รายการ' });
        req.flash('itemFlash', itemData) // flash เก็บข้อมูลไอเทมเมื่อ error
        return res.redirect(redirectUrl_error)
      }
    }else if(itemData.itemPackageType === "single"){
      itemData.itemsInSet = [] // ถ้าเปลี่ยนจาก set เป็น single ให้ล้าง itemsInSet ทิ้ง
    }
    
    //=== 4.) ตรวจสอบ _id
    const _id = req.body._id

    //== 4.1) ไม่มี _id - 'เพิ่มใหม่' 
    if (!_id) {

      //= 4.2.1) ตรวจสอบ itemId - รูปแบบต้องถูกต้องหรือไม่
      if(itemId){
        const regex = new RegExp(ITEM_TYPE_PATTERN)
        if (!regex.test(req.body.itemId)) {
          req.flash("msg", { class:"red", text: global.ITEM_TYPE_DESCRIPTION.replace(",", "{{sep}}") });
          req.flash('itemFlash', itemData) // flash เก็บข้อมูลไอเทมเมื่อ error
          return res.redirect(redirectUrl_error)
        }
      }

      //= 4.2.2) ค้นหา itemId แต่ไม่รวมตัวเอง
      var itemFind = await collection.findOne({
        // _id: { $ne: new ObjectId(_id) } , // ไม่เอาตัวเอง - ไม่ต้องใช้เพราะเป็นการสร้างใหม่ไม่มี _id
        $or: [
          { itemId:itemId } ,
          // { userId:userId } ,
        ]
      })
      // console.log("itemFind ===> ", itemFind)

      //= 4.2.3) ถ้ามี itemFind - _id จะไม่เป็น undefined และไม่เท่ากับ _id ที่ส่งมาด้วย)
      if (itemFind) {
        req.flash('msg', { class: "red", text: `ไอดี "${itemId}" มีอยู่ในระบบแล้ว` })
        req.flash('itemFlash', itemData) // flash เก็บข้อมูลไอเทมเมื่อ error
        return res.redirect(redirectUrl_error)
      }
      
      //= 4.2.4)  Stamp วันเวลาสำหรับแก้ไข เฉพาะ new เท่านั้น (1 วัน)
      itemData.dateTimeCanDelete = myDateTime.getDateTime(1440) // 1 วัน = 1440 นาที
      
      //= 4.2.5) ถ้ามีไฟล์ ให้ใส่ชื่อไฟล์ไปด้วย
      if (req.file) {  
        itemData.itemImage = req.file.filename 
      }

      //= 4.2.6) สร้างข้อมูลใหม่
      var rtnResult = await collection.insertOne(itemData)

      //= 4.2.7) โหลดตัวนัน้มาแทน ถ้าสร้างใหม่
      var redirect_new =   `${PATH_MAIN}?`+                  
                           `scid=${scid}&sis=${sis}` + // sip=${sip}
                           `&rpp=${rpp}&page=${page}&loadId=${itemId}`
    }
    //== 4.3) อัปเดต - มี _id
    else { 

      //== 4.3.1) ถ้ามีไฟล์อัปโหลด ให้ใส่ชื่อไฟล์ไปด้วย - ถ้าไม่มี อาจมีอยู่แล้ว ไม่ต้องไปยุ่ง
      if (req.file) { 
        itemData.itemImage = req.file.filename 
      }

      //= 4.3.2) ถ้าไม่พบ _id คืนค่า matchedCount == 0 / modifiedCount ==  0
      var rtnResult = await collection.updateOne(
        { _id: new ObjectId(_id) },
        { $set: itemData }
      )
    }
    // console.log("rtnResult ===> ", rtnResult)

    //=== 5.) ถ้าอัปเดตหรือเพิ่มใหม่สำเร็จ
    if (rtnResult && rtnResult.insertedId) { // Insert
      req.flash("msg", { class:"green", text:`เพิ่ม "${itemId}" เรียบร้อยแล้ว`, })
      res.redirect(redirect_new)
    }else if (rtnResult && rtnResult.matchedCount == 1 && rtnResult.modifiedCount > 0) { // Update
      req.flash("msg", { class:"green", text:`อัปเดต "${itemId}" เรียบร้อยแล้ว`, })
      res.redirect(redirect_Url)
    }else if (rtnResult && rtnResult.matchedCount == 1 && rtnResult.modifiedCount ==  0) { // Update - ไม่มีอะไรเปลี่ยน
      if(req.file){ // แต่มีการอัปโหลดภาพใหม่
        req.flash("msg", { class:"green", text:`อัปเดตภาพของ "${itemId}" เรียบร้อยแล้ว`, })
      }else{
        req.flash("msg", { class:"yellow", text:`"${itemId}" ไม่มีอะไรเปลี่ยนแปลง`, })
      }
      res.redirect(redirect_Url)
    }else if (rtnResult && rtnResult.matchedCount == 0 ) { // Update - ไม่พบ
      req.flash("msg", { class:"red", text:`ไม่พบ "${itemId}" ในระบบ` })
      req.flash('itemFlash', itemData) // flash เก็บข้อมูลไอเทมเมื่อ error
      res.redirect(redirectUrl_error)
    }else { // Error
      req.flash("msg", { class:"red", text:`เกิดข้อผิดพลาดกับฐานข้อมูล"` })
      req.flash('itemFlash', itemData) // flash เก็บข้อมูลไอเทมเมื่อ error
      res.redirect(redirectUrl_error)
    }
  } catch (err) {
    console.log(err)
    // res.sendFile(file404)
    res.redirect(redirectUrl_error)
  } finally {
    client.close()
  }
})


//=============================================
//
router.post(PATH_LOAD, mainAuth.isOS, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)

  const loadId = req.body.loadId
  const sip = req.body.sip?.toString().replace(/[!@#$%^&*\///]/g, '')??''
  const scid = req.body.scid
  const sis = req.body.sis
  const rpp = Number(req.body.rpp) || 30
  const page = Number(req.body.page) || 1
  // console.log("loadId ===> " , loadId)
  // console.log("sip ===> " , sip)
  // console.log("scid ===> " , scid)
  // console.log("sis ===> " , sis)
  // console.log("rpp ===> " , rpp)
  // console.log("page ===> " , page)

  const redirectUrl_normal = `${PATH_MAIN}?`+
                             `sip=${sip}&scid=${scid}&sis=${sis}` +
                             `&rpp=${rpp}&page=${page}&loadId=${loadId}`

  const client = new MongoClient(global.dbUrl)
  try{
    const db = client.db(global.dbName)
    const coll_items = db.collection(global.dbColl_items)
    const docItem = await coll_items.findOne({ itemId:loadId }, { projection : { _id : 0 } })

    // console.log("docItem ===> ", docItem) 
    //=== โหลดที่ path main
    // if(docItem.itemImage){
    //   const imagePath = path.join(folderItems, docItem.itemImage);
    //   try {
    //     const imageBuffer = await fs.promises.readFile(imagePath);
    //     docItem.itemImageBase64 = imageBuffer.toString('base64');
    //   } catch (err) {
    //     console.log("Error reading image file:", err.message);
    //     docItem.itemImageBase64 = null;
    //   }
    // }

    if( docItem ){
      req.flash('msg', null)
      return res.redirect(redirectUrl_normal)
    }else{  
      req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${loadId}"` })
      return res.redirect(PATH_MAIN)
    }
  }catch(err){
    console.log(err.message)
    req.flash('msg', { class:"red", text:`${err.message}` })
    return res.redirect(PATH_MAIN)
  }finally{
    client.close()
  }
})


//=======================================================
// delete
// 
router.post(PATH_DELETE, mainAuth.isOS, async (req,res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)
  // req.body ===>  {
  // _id: '68b8e7ccc26bb8e6245329f2',
  // loadId: '',
  // page: '1',
  // rpp: '30',
  // sip: '',
  // scid: '',
  // sis: '',
  // itemIdToDelete: '123456789'
  // }
  
  const loadId = req.body.loadId
  const itemIdToDelete = req.body.itemIdToDelete
  const sip = req.body.sip?.replace(/[!@#$%^&*\///]/g, '')??''
  // const _id = req.body._id 
  const scid = req.body.scid
  const sis = req.body.sis
  const rpp = Number(req.body.rpp) || 30
  const page = Number(req.body.page) || 1

  // return res.redirect(PATH_MAIN) // ถ้าไม่มี itemIdToDelete ให้กลับไปหน้า main
  
  const redirectUrl_normal = `${PATH_MAIN}?`+
                             `sip=${sip}&scid=${scid}&sis=${sis}` +
                             `&rpp=${rpp}&page=${page}&loadId=${loadId}` // ไม่มี loadId เพราะลบไปแล้ว 

  // //===
  // const deleteConfirm = req.body.deleteConfirm
  // if(deleteConfirm != "confirm"){
  //   req.flash('msg', { class:"red", text:`กรุณาพิมพ์ "confirm" เพื่อลบ` })
  //   return res.redirect(redirectUrl_normal)
  // }

  const client = new MongoClient(global.dbUrl)
  try{
    const db = client.db(global.dbName)
    const coll_items = db.collection(global.dbColl_items)

    //=== 1.) ตรวจสอบว่ามีไอเท็มที่จะลบหรือไม่
    const itemDoc = await coll_items.findOne({ itemId:itemIdToDelete })
    if(!itemDoc){
      req.flash('msg', { class:"red", text:`ไม่พบ "${itemIdToDelete}"` })
      return  res.redirect(PATH_MAIN)
    }
    // console.log("itemDoc ===> ", itemDoc)

    //=== 2.) ตรวจสอบ Item ที่จะลบต้องไม่มีในเอกสารทุกตัว ***
    // 
    const collections = [
      { coll: db.collection(global.dbColl_warehouseIn),  name: global.dbColl_warehouseIn },
      { coll: db.collection(global.dbColl_warehouseOut), name: global.dbColl_warehouseOut },
      { coll: db.collection(global.dbColl_sales),        name: global.dbColl_sales },
    ];
    // ตรวจสอบทุก collection พร้อมกัน ****
    for (const { coll, name } of collections) {
      const docFind = await coll.findOne({ "items.itemId": itemIdToDelete });
      if (docFind) {
        //== Stamp ว่าลบไม่ได้ เอาไปใช้ตอนสร้าง Table
        await coll_items.updateOne(
          { itemId: itemIdToDelete }, 
          { $set: { canDelete: false } }
        );
        req.flash('msg', { 
          class: "red", 
          text: `ไอเท็ม "${itemIdToDelete}" มีอยู่ในเอกสาร ${name}{{sep}}ไม่สามารถลบได้` 
        });
        return res.redirect(redirectUrl_normal);
      }
    }

    //=== 3.) ลบไอเท็ม 
    const deleteRtn = await coll_items.deleteOne({ itemId:itemIdToDelete })
    // console.log("deleteRtn ===> ", deleteRtn)
    if(deleteRtn.deletedCount == 1){  //=== ลบได้
      const itemImage = itemDoc.itemImage
      if(itemImage){

        //== ถ้าลบได้ ให้ลบภาพต่อ 
        // - ลบภาพหลักและ thumbnail ด้วย
        const imagePath = path.join(folderItems, itemImage)
        const [filename,ext] = itemImage.split('.')
        const imageThumbPath = path.join(folderItems, `${filename}_thumb.${ext}`)

        try {
          await fs.promises.unlink(imagePath)
          await fs.promises.unlink(imageThumbPath)
          req.flash('msg', { class:"green", text:`ลบ "${itemIdToDelete}" และ ภาพเรียบร้อยแล้ว` })
          return res.redirect(redirectUrl_normal)
        } catch (err) {
          // console.error('Error deleting image:', err)
          req.flash('msg', { class:"green", text:`ลบข้อมูลได้ แต่ลบภาพไม่ได้` })
          return res.redirect(redirectUrl_normal)
        }
      }else{
        req.flash('msg', { class:"green", text:`ลบ "${itemIdToDelete}" เรียบร้อยแล้ว` })
        return res.redirect(redirectUrl_normal)
      }
    }else{
      // console.log("Error while deleting")
      req.flash('msg', { class:"red", text:`เกิดข้อผิดพลาดขณะลบ "${loadId}"` })
      return res.redirect(PATH_MAIN)
    }
  }catch(err){
    console.log(err)
    res.sendFile(file404)
  }finally{
    client.close()
  }
})


//======================================================
// 
router.get(`${PATH_VIEW}/:filename`, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  const filename = req.params.filename
  const fileExtension = path.extname(filename).toLowerCase()
  const imagePath = path.join(folderItems, filename)
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', }
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

//======================================================
// 
router.get(`${PATH_FETCH_IMAGE}/:filename`, mainAuth.isAuth, async (req, res) => {
  const filename = req.params.filename
  const fileExtension = path.extname(filename).toLowerCase()
  const imagePath = path.join(folderItems, filename)
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', }
  fs.readFile(imagePath, (err, data) => {
    if (err) {
      // console.error('Error reading image:', err)
      return res.send(null) // ส่ง null ถ้าไม่พบภาพ
    }

    // คืนค่าเป็น base64
    const base64Image = `data:${mimeTypes[fileExtension]};base64,${data.toString('base64')}`;
    res.send(base64Image);
  })
})



//=============================================
//
// 
router.post(PATH_PRINT, mainAuth.isOS, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)

  const { itemIdArr: itemIdArr } = req.body

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_items)

    //=== 1.) ค้นหาไอเท้ม
    const itemsFind = await collection.aggregate([
      { $match: { 
          itemId: { $in: itemIdArr }
        } 
      },
      { $project: {  _id : 0 } },      
      { $addFields: { // เรียงลำดับตามอาเรย์ jobIdArr ที่ส่งมา
          __order: { $indexOfArray: [itemIdArr, "$itemId"] } 
        }
      },
      { $sort: { __order: 1 } },
    ]).toArray()


    //=== 2.) ตรวจสอบว่ามีข้อมูลที่จะพิมพ์หรือไม่
    if(itemsFind.length == 0){
      return res.send(JSON.stringify({
        isPrint : false,
        class : "red",
        msg: `ไม่มีข้อมูลที่จะพิมพ์` , 
      }))
    }


    //=== 3.) สร้างฟอร์มจาก HTML
    const templatePath = path.join(folderForm, 'formItems.ejs')
    const templateContent = fs.readFileSync(templatePath, 'utf8'); 
    const htmlPage = ejs.render(templateContent, {
      web_title : `Print ${itemsFind.length} Items`,
      title : `ไอเท็ม`,
      data : itemsFind,
      dateTime : DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm'),
    })

    res.send(JSON.stringify({
      isPrint : true,
      class : "green",
      htmlPage : htmlPage ,
      msg: `พิมพ์ ${itemsFind.length} ไอเท็มเรียบร้อยแล้ว` ,
    }))
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({
      isPrint : false,
      class : "red",
      msg: err.message , 
    }))
  } finally {
    client.close();
  } 
})


//================================================================
// fetch ข้อมูลสำหรับทำ Modal Selector
// 
router.get(PATH_FETCH, mainAuth.isOS, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.body)
  try{
    //=== จับข้อมูล Customers/Items สำหรับใช้ทำ Modal
    // - จับเฉพาะ itemPackageType ที่เป็น single เท่านั้น 
    const DATA_ITEMS = await myData.getItems_for_Modal('active')
    return res.send(JSON.stringify({
      DATA_ITEMS,
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




export default router



