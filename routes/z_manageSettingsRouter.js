// import * as myModule from "../mymodule/myModule.js"
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js" 
// import path from 'path'  ;
// import fs from 'fs'  ;
// import multer from 'multer'  ;
import express from 'express' ;
const router = express.Router() ;
import { MongoClient } from 'mongodb' ;
import { exec } from 'child_process' // สำหรับรันคำสั่ง Terminal
import path from 'path'
import mainAuth from "../middleware/mainAuth.js"   ;
const myModule = await import(`../${mymoduleFolder}/myModule.js`)  ;
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)  ;
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)  ;
const PATH_MAIN = '/manage/settings'  ;
const PATH_SAVE = `${PATH_MAIN}/save`  ;
const PATH_BACKUP_DB = `${PATH_MAIN}/backup-db`
const PATH_UPDATE_SYSTEM = `${PATH_MAIN}/update-system`
const PATH_RESTART_PM2 = `${PATH_MAIN}/restart-pm2`
const PREFIX = PATH_MAIN.replace(/\//g,"_") 

//================================================================
// โหลด settings หน้าแรก
// 
router.get(PATH_MAIN, mainAuth.isOA , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)  
  // console.log(req.query)

  //=== query string สำหรับคลิก tab เช่น tab=4
  const { tab:tabNumberClicked } = req.query

  const client = new MongoClient(global.dbUrl);
  try{

    const html = await myModule.renderView('manageSettings', res, {
      title : PAGE_MANAGE_SETTINGS ,
      time : myDateTime.getDate(),  
      msg : req.flash('msg'),
      user : myUsers.getSessionData(req),
      settings : await myModule.getSettings(),

      tabNumberClicked,
      PATH_MAIN,
      PATH_SAVE,

      PATH_RESTART_PM2,
      PATH_BACKUP_DB,
      PATH_UPDATE_SYSTEM,
      PREFIX,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }
})



//================================================================
// Save
// 
router.post(PATH_SAVE, mainAuth.isOA, async (req,res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log(req.body)
  
  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(dbName)
    const collection = db.collection(dbColl_settings)
    await collection.deleteMany({})
    const rtn = await collection.insertOne(req.body)

    if( rtn.acknowledged){
      req.flash('msg', { class:"green", text:`บันทึกข้อมูลการตั้งค่าแล้ว` })
      res.redirect(PATH_MAIN)
    }else{
      req.flash('msg', { class:"red", text:`เกิดข้อผิดพลาดขณะบันทึกข้อมูลการตั้งค่า` })
      res.redirect(PATH_MAIN)
    }
  }catch(err){
    req.flash('msg', { class:"red", text:`${err.message}` })
    res.redirect(PATH_MAIN)
  }finally{
    client.close()
  }
})


//=======================================================
//
router.post(PATH_BACKUP_DB,  mainAuth.isOA , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  const path_redirect = `${PATH_MAIN}?tab=2`;
  try {
    //=== รันคำสั่งจาก package.json ที่กำหนดไว้
    const rootDir = process.cwd()
    // console.log('rootDir ===> ', rootDir);
    // สร้างชื่อโฟลเดอร์ backup ตามวันเวลา
    // const dt = DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm').replace(/[: ]/g, '-');
    const dt = myDateTime.getDateTime().replace(/[: ]/g, '-');
    const backupDir = path.join(rootDir, 'backup', `${dbName}_${dt}`);
    const cmd = `mongodump --db ${dbName} --out "${backupDir}"`;
    // console.log('rootDir ===> ', rootDir);
    // console.log('cmd ===> ', cmd);
    // rootDir ===>  D:\aWK_LeaseSystem\DC4
    // cmd ===>  mongodump --db docsCreator --out "D:\aWK_LeaseSystem\DC4\backup\docsCreator_2025-08-31-08-39"

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        req.flash('msg', { 
          class: "red", 
          text: `Backup error: ${error.message}` 
        });
        return res.redirect(path_redirect);
      }

      //=== ลบโฟลเดอร์อื่นๆ ในโฟลเดอร์ backup ที่ไม่ใช่ backup ล่าสุดออกไป 
      let msg = `แบ็คอัพฐานข้อมูล "${dbName}" ไปยัง{{sep}}${backupDir}{{sep}}สำเร็จ`
      fs.readdir(path.join(rootDir, 'backup'), (err, files) => {
        if (err) {
          console.log('Error reading backup directory:', err);
          return;
        }
        files.forEach(file => {
          const filePath = path.join(rootDir, 'backup', file);
          if (file !== `${dbName}_${dt}`) {
            fs.rm(filePath, { recursive: true, force: true }, (err) => {
              if (err) {
                console.log(`Error deleting old backup folder ${file}:`, err);
              } else {
                console.log(`Deleted old backup folder: ${file}`);
              }
            });
          }
        });
      });

      req.flash('msg', { class: "green", text: msg });
      res.redirect(path_redirect);
    });
  } catch (err) {
    console.log(err)
    req.flash('msg', { class:"red", text:err.message})
    res.redirect(path_redirect)
  }

})


//=======================================================
//
router.post(PATH_UPDATE_SYSTEM,  mainAuth.isOA , async (req, res) => {

  try {
    //=== รันคำสั่งจาก package.json ที่กำหนดไว้
    const rootDir = process.cwd()
    const path_redirect = `${PATH_MAIN}?tab=2`;

    //=== update ระบบโดยใช้ git pull - <path/to/your/repo>
    // - แต่ต้องตรวจสอบ .env SOURCE_CODE ก่อนว่าเป็น main หรือเปล่า ถ้าเป็น main อัปเดทไม่ได้
    // - main(ไม่ใช่ branch) แต่เป็นตัวที่บอกว่า เป็นจุดที่โค้ดถูกพัฒนาขึ้นมา
    // - ตัว deploy ให้เซ็ต SOURCE_CODE เป็น main ด้วย
    // - ยกเว้นบน VPS ที่นำไปใช้งานจริง หรือ Server ของลูกค้า 
    const sourceCode = process.env.SOURCE_CODE || '';
    if (!sourceCode) {
      req.flash('msg', { 
        class: "red", 
        text: `ไม่พบพารามิเตอร์ SOURCE_CODE ใน .env` 
      });
      return res.redirect(path_redirect);
    }else if (sourceCode === 'main') {
      req.flash('msg', { 
        class: "red", 
        text: `ไม่สามารถอัปเดท Source Code ที่เป็น 'main' ได้` 
      });
      return res.redirect(path_redirect);
    }else if (sourceCode !== 'copy') {
      req.flash('msg', { 
        class: "red", 
        text: `ไม่สามารถอัปเดท Source Code ที่ไม่ใช่ 'copy'` 
      });
      return res.redirect(path_redirect);
    }else if(sourceCode === 'copy'){
      const cmd = `cd ${rootDir} && git pull origin main`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          req.flash('msg', { 
            class: "red", 
            text: `Backup error: ${error.message}` 
          });
          return res.redirect(path_redirect);
        }
        const msg = `อัปเดทระบบสำเร็จ{{sep}}${stdout}{{sep}}${stderr}{{sep}}โปรดเริ่มต้นระบบใหม่`
        req.flash('msg', { class: "green", text: msg });
        res.redirect(path_redirect);
      });
    }  
  } catch (err) {
    console.log(err)
    req.flash('msg', { class:"red", text:err.message})
    res.redirect(path_redirect)
  }

})



//=======================================================
//
router.post(PATH_RESTART_PM2,  mainAuth.isOA , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  const rootDir = process.cwd();
  const chgDir = `cd ${rootDir}`;
  const path_redirect = `${PATH_MAIN}?tab=2`;

  //=== ตรวจสอบ process ด้วย pm2 jlist (JSON)
  exec('pm2 jlist', (error, stdout, stderr) => {

    //== ตรวจสอบ error เบื้องต้น
    if (error) {
      req.flash('msg', { 
        class: "red", 
        text: `เกิดข้อผิดพลาดในการตรวจสอบ PM2: ${error.message}` 
      });
      return res.redirect(path_redirect);
    }
    let pm2List = [];

    //== แปลง JSON ที่ได้มาเป็น object
    try {
      pm2List = JSON.parse(stdout);
    } catch (e) {
      req.flash('msg', { 
        class: "red", 
        text: `อ่านข้อมูล PM2 ไม่สำเร็จ: ${e.message}` 
      });
      return res.redirect(path_redirect);
    }

    //== ตรวจสอบชื่อ process ที่ต้องการ (เช่น 'mpos')
    const processName = 'mpos';
    const found = pm2List.some(proc => proc.name === processName);
    if (!found) {
      req.flash('msg', { 
        class: "red", 
        text: `ไม่พบโปรเซสที่รันด้วย PM2 ชื่อ '${processName}' ในระบบ` 
      });
      return res.redirect(path_redirect);
    }

    //== แจ้งผู้ใช้ก่อน แล้วค่อย restart ใน background
    req.flash('msg', { class: "green", text: `กำลังรีสตาร์ทระบบ...{{sep}}หลังรีสตาร์ทให้โหลดหน้าเว็บใหม่` });
    res.redirect(path_redirect);

    //== รีสตาร์ท PM2
    //   - delay เล็กน้อยให้ response กลับไปก่อน
    setTimeout(() => {
      const restartNpm = `npm run restart`;
      exec(`${chgDir} && ${restartNpm}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
        }
      });
    }, 1000); 
    
  });

})



export default router














// /*****************************************************
// ******************************************************
// ******************************************************
// ******************** Quotation ***********************
// ******************************************************
// ******************************************************
// ******************************************************/

// //=======================================================
// //
// // 
// const uploadQuotationLogo = multer({ 
//   storage: multer.diskStorage({
//     destination: async function (req, file, cb) { // Make the destination function async
//       try {
//         await fs.promises.mkdir(global.folderDocs, { recursive: true }); // Use async mkdir
//         cb(null, global.folderDocs);
//       } catch (err) {
//         cb(err); 
//       }
//     },
  
//     filename: function (req, file, cb) {
//       //=== ตั้งชื่อแบบส่มตัวเลข - ห้ามลบ 
//       // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//       // cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  
//       // const itemId = req.body.itemId
//       // const regex = new RegExp(ITEM_TYPE_PATTERN)
//       // if (!regex.test(itemId)) {
//       //   cb(new Error('ไอดีไม่ถูกต้อง'))
//       // }else{
//       //   //=== ตั้งชื่อตามไอดี
//       //   const fileExtension = path.extname(file.originalname);
//       //   const filename = `${itemId}${fileExtension}`; // Use _id as filename
//       //   cb(null, filename);
//       // }
//       //=== ตั้งชื่อไฟล์ภาพแบบเจาะจง
//       // const fileExtension = path.extname(file.originalname);
//       // const filename = `${global.LOGO_QUOTATION_FILENAME}${fileExtension}`; // Use _id as filename
//       const filename = `${global.LOGO_QUOTATION_FILENAME}`; // Use _id as filename
//       cb(null, filename);
//     },
//   }) ,
//   limits: { fileSize: 1024 * 1024 * 1 }, // จำกัด 1MB
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = ['.png']; // รับ png เท่านั้น
//     const fileExtension = path.extname(file.originalname).toLowerCase();
//     if (allowedMimeTypes.includes(fileExtension)) {
//       cb(null, true)
//     } else {
//       cb(new Error('รับเฉพาะภาพ .png เท่านั้น'))
//     }
//   },
// }).single('HEADER_QUOTATION_LOGO_FILE')
// //================================================================
// // Centralized Error Handling Middleware
// // 
// const handleMulterError_UploadQuotationLogo = async (err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     // console.error("Multer Error:", err.message);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=2`)
//   } else if (err) { // An unknown error occurred.
//     // console.error("Unknown Upload Error:", err);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=2`);
//   } else { // No error, continue to the next middleware
//     next() 
//   }
// }
// //==== 
// router.post(PATH_SAVE_QUOTATION, [ 
//     mainAuth.isAuth ,      // 1
//     ( req, res, next) => { // 2 - อัปโหลดไฟล์ (เขียนแบบนี้เพราะต้องการ handleMulterError)
//       uploadQuotationLogo(req, res, (err) => {
//         if (err) {
//           return handleMulterError_UploadQuotationLogo(err, req, res, next)
//         }
//         next()
//       })
//     } 
//   ], async (req,res) => {

//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log("req.body ===> ", req.body)
//   // console.log("req.file ===> ", req.file)

//   //===   
//   const redirect_Url = `${PATH_MAIN}?tab=2`  

//   const client = new MongoClient(global.dbUrl)
//   try {    
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_settings_Quotation)

//     //=== 1.) ข้อมูลที่จะ Save - แยกจากการอัปโหลดภาพ 
//     const settingsData = {
//       HEADER_COMPANY_NAME: req.body.HEADER_COMPANY_NAME,
//       HEADER_LINE_2: req.body.HEADER_LINE_2,
//       HEADER_LINE_3: req.body.HEADER_LINE_3,
//       DOC_REMARK: req.body.DOC_REMARK,
//       // HEADER_QUOTATION_LOGO_FILE: req.file.filename, // เอาออก - ไปเพิ่มทีหลัง
//     }
//     if (req.file){  //  ถ้ามีภาพ 
//       settingsData.HEADER_QUOTATION_LOGO_FILE = req.file.filename 
//     }

//     //=== 2.) ถ้าอัปเดตหรือเพิ่มใหม่สำเร็จ
//     // - ลบของเท่าทั้งหมดก่อน
//     await collection.deleteMany({})
//     const rtn = await collection.insertOne(settingsData)
//     if(rtn.acknowledged){
//       req.flash("msg", { class:"green", text:`บันทึกการตั้งค่าใบเสนอราคาเรียบร้อยแล้ว` })
//       res.redirect(redirect_Url)
//     }else{
//       req.flash("msg", { class:"red", text:`เกิดข้อผิดพลาดขณะบันทึกการตั้งค่าใบเสนอราคา` })
//       res.redirect(redirect_Url)
//     }
//   } catch (err) {
//     console.log(err)
//     res.sendFile(file404)
//   } finally {
//     client.close()
//   }
// })




/*****************************************************
******************************************************
******************************************************
*********************** Invoice ***********************
******************************************************
******************************************************
******************************************************/




// //=======================================================
// // 
// // 
// const uploadInvoiceLogo = multer({ 
//   storage: multer.diskStorage({
//     destination: async function (req, file, cb) { // Make the destination function async
//       try {
//         await fs.promises.mkdir(global.folderDocs, { recursive: true }); // Use async mkdir
//         cb(null, global.folderDocs);
//       } catch (err) {
//         cb(err); 
//       }
//     },
  
//     filename: function (req, file, cb) {
//       const filename = `${global.LOGO_INVOICE_FILENAME}`; // Use _id as filename
//       cb(null, filename);
//     },
//   }) ,
//   limits: { fileSize: 1024 * 1024 * 1 }, // จำกัด 1MB
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = ['.png']; // รับ png เท่านั้น
//     const fileExtension = path.extname(file.originalname).toLowerCase();
//     if (allowedMimeTypes.includes(fileExtension)) {
//       cb(null, true)
//     } else {
//       cb(new Error('รับเฉพาะภาพ .png เท่านั้น'))
//     }
//   },
// }).single('HEADER_INVOICE_LOGO_FILE')
// //================================================================
// // Centralized Error Handling Middleware
// // 
// const handleMulterError_UploadInvoiceLogo = async (err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     // console.error("Multer Error:", err.message);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=3`)
//   } else if (err) { // An unknown error occurred.
//     // console.error("Unknown Upload Error:", err);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=3`);
//   } else { // No error, continue to the next middleware
//     next() 
//   }
// }
// //==== 
// router.post(PATH_SAVE_INVOICE, [ 
//     mainAuth.isAuth ,      // 1
//     ( req, res, next) => { // 2 - อัปโหลดไฟล์ (เขียนแบบนี้เพราะต้องการ handleMulterError)
//       uploadInvoiceLogo(req, res, (err) => {
//         if (err) {
//           return handleMulterError_UploadInvoiceLogo(err, req, res, next)
//         }
//         next()
//       })
//     } 
//   ], async (req,res) => {

//   //===   
//   const redirect_Url = `${PATH_MAIN}?tab=3`  

//   const client = new MongoClient(global.dbUrl)
//   try {    
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_settings_Invoice)

//     //=== 1.) ข้อมูลที่จะ Save - แยกจากการอัปโหลดภาพ 
//     const settingsData = {
//       HEADER_COMPANY_NAME: req.body.HEADER_COMPANY_NAME,
//       HEADER_LINE_2: req.body.HEADER_LINE_2,
//       HEADER_LINE_3: req.body.HEADER_LINE_3,
//       DOC_REMARK: req.body.DOC_REMARK,
//       // HEADER_INVOICE_LOGO_FILE: req.file.filename, // เอาออก - ไปเพิ่มทีหลัง
//     }
//     if (req.file){  //  ถ้ามีภาพ 
//       settingsData.HEADER_INVOICE_LOGO_FILE = req.file.filename 
//     }

//     //=== 2.) ถ้าอัปเดตหรือเพิ่มใหม่สำเร็จ
//     // - ลบของเท่าทั้งหมดก่อน
//     await collection.deleteMany({})
//     const rtn = await collection.insertOne(settingsData)
//     if(rtn.acknowledged){
//       req.flash("msg", { class:"green", text:`บันทึกการตั้งค่าใบแจ้งหนี้ราคาเรียบร้อยแล้ว` })
//       res.redirect(redirect_Url)
//     }else{
//       req.flash("msg", { class:"red", text:`เกิดข้อผิดพลาดขณะบันทึกการตั้งค่าใบแจ้งหนี้` })
//       res.redirect(redirect_Url)
//     }
//   } catch (err) {
//     console.log(err)
//     res.sendFile(file404)
//   } finally {
//     client.close()
//   }
// })





// /*****************************************************
// ******************************************************
// ******************************************************
// *********************** Receipt **********************
// ******************************************************
// ******************************************************
// ******************************************************/


// //=======================================================
// // 
// // 
// const uploadReceiptLogo = multer({ 
//   storage: multer.diskStorage({
//     destination: async function (req, file, cb) { // Make the destination function async
//       try {
//         await fs.promises.mkdir(global.folderDocs, { recursive: true }); // Use async mkdir
//         cb(null, global.folderDocs);
//       } catch (err) {
//         cb(err); 
//       }
//     },
  
//     filename: function (req, file, cb) {
//       const filename = `${global.LOGO_RECEIPT_FILENAME}`; // Use _id as filename
//       cb(null, filename);
//     },
//   }) ,
//   limits: { fileSize: 1024 * 1024 * 1 }, // จำกัด 1MB
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = ['.png']; // รับ png เท่านั้น
//     const fileExtension = path.extname(file.originalname).toLowerCase();
//     if (allowedMimeTypes.includes(fileExtension)) {
//       cb(null, true)
//     } else {
//       cb(new Error('รับเฉพาะภาพ .png เท่านั้น'))
//     }
//   },
// }).single('HEADER_RECEIPT_LOGO_FILE')
// //================================================================
// // Centralized Error Handling Middleware
// // 
// const handleMulterError_UploadReceiptLogo = async (err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     // console.error("Multer Error:", err.message);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=4`)
//   } else if (err) { // An unknown error occurred.
//     // console.error("Unknown Upload Error:", err);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=4`);
//   } else { // No error, continue to the next middleware
//     next() 
//   }
// }
// //==== 
// router.post(PATH_SAVE_RECEIPT, [ 
//     mainAuth.isAuth ,      // 1
//     ( req, res, next) => { // 2 - อัปโหลดไฟล์ (เขียนแบบนี้เพราะต้องการ handleMulterError)
//       uploadReceiptLogo(req, res, (err) => {
//         if (err) {
//           return handleMulterError_UploadReceiptLogo(err, req, res, next)
//         }
//         next()
//       })
//     } 
//   ], async (req,res) => {

//   //===   
//   const redirect_Url = `${PATH_MAIN}?tab=4`  

//   const client = new MongoClient(global.dbUrl)
//   try {    
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_settings_Receipt)

//     //=== 1.) ข้อมูลที่จะ Save - แยกจากการอัปโหลดภาพ 
//     const settingsData = {
//       HEADER_COMPANY_NAME: req.body.HEADER_COMPANY_NAME,
//       HEADER_LINE_2: req.body.HEADER_LINE_2,
//       HEADER_LINE_3: req.body.HEADER_LINE_3,
//       DOC_REMARK: req.body.DOC_REMARK,
//       // HEADER_INVOICE_LOGO_FILE: req.file.filename, // เอาออก - ไปเพิ่มทีหลัง
//     }
//     if (req.file){  //  ถ้ามีภาพ 
//       settingsData.HEADER_RECEIPT_LOGO_FILE = req.file.filename 
//     }

//     //=== 2.) ถ้าอัปเดตหรือเพิ่มใหม่สำเร็จ
//     // - ลบของเท่าทั้งหมดก่อน
//     await collection.deleteMany({})
//     const rtn = await collection.insertOne(settingsData)
//     if(rtn.acknowledged){
//       req.flash("msg", { class:"green", text:`บันทึกการตั้งค่าใบเสร็จรับเงินเรียบร้อยแล้ว` })
//       res.redirect(redirect_Url)
//     }else{
//       req.flash("msg", { class:"red", text:`เกิดข้อผิดพลาดขณะบันทึกการตั้งค่าใบเสร็จรับเงิน` })
//       res.redirect(redirect_Url)
//     }
//   } catch (err) {
//     console.log(err)
//     res.sendFile(file404)
//   } finally {
//     client.close()
//   }
// })





// /*****************************************************
// ******************************************************
// ******************************************************
// ******************** Cash Bill ***********************
// ****************** ( ไม่มีหัวกระดาษ) ********************
// ******************************************************
// ******************************************************
// ******************************************************/


// //=======================================================
// // 
// // 
// const uploadBillLogo = multer({ 
//   storage: multer.diskStorage({
//     destination: async function (req, file, cb) { // Make the destination function async
//       try {
//         await fs.promises.mkdir(global.folderDocs, { recursive: true }); // Use async mkdir
//         cb(null, global.folderDocs);
//       } catch (err) {
//         cb(err); 
//       }
//     },
  
//     filename: function (req, file, cb) {
//       const filename = `${global.LOGO_BILL_FILENAME}`; // Use _id as filename
//       cb(null, filename);
//     },
//   }) ,
//   limits: { fileSize: 1024 * 1024 * 1 }, // จำกัด 1MB
//   fileFilter: (req, file, cb) => {
//     const allowedMimeTypes = ['.png']; // รับ png เท่านั้น
//     const fileExtension = path.extname(file.originalname).toLowerCase();
//     if (allowedMimeTypes.includes(fileExtension)) {
//       cb(null, true)
//     } else {
//       cb(new Error('รับเฉพาะภาพ .png เท่านั้น'))
//     }
//   },
// }).single('HEADER_BILL_LOGO_FILE')
// //================================================================
// // Centralized Error Handling Middleware
// // 
// const handleMulterError_UploadBillLogo = async (err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     // console.error("Multer Error:", err.message);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=5`)
//   } else if (err) { // An unknown error occurred.
//     // console.error("Unknown Upload Error:", err);
//     req.flash('msg', { class: "red", text: `อัปโหลดผิดพลาด : ${err.message}` });
//     res.redirect(`${PATH_MAIN}?tab=5`);
//   } else { // No error, continue to the next middleware
//     next() 
//   }
// }
// //==== 
// router.post(PATH_SAVE_BILL, [ 
//     mainAuth.isAuth ,      // 1
//     ( req, res, next) => { // 2 - อัปโหลดไฟล์ (เขียนแบบนี้เพราะต้องการ handleMulterError)
//       uploadBillLogo(req, res, (err) => {
//         if (err) {
//           return handleMulterError_UploadBillLogo(err, req, res, next)
//         }
//         next()
//       })
//     } 
//   ], async (req,res) => {

//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log(req.body)
//   // console.log(req.file)

//   //===   
//   const redirect_Url = `${PATH_MAIN}?tab=5`  

//   const client = new MongoClient(global.dbUrl)
//   try {    
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_settings_Bill)

//     //=== 1.) ข้อมูลที่จะ Save - แยกจากการอัปโหลดภาพ 
//     const settingsData = {
//       HEADER_COMPANY_NAME: req.body.HEADER_COMPANY_NAME,
//       HEADER_LINE_2: req.body.HEADER_LINE_2,
//       HEADER_LINE_3: req.body.HEADER_LINE_3,
//       DOC_REMARK: req.body.DOC_REMARK,
//       // HEADER_INVOICE_LOGO_FILE: req.file.filename, // เอาออก - ไปเพิ่มทีหลัง
//     }
//     if (req.file){  //  ถ้ามีภาพ 
//       settingsData.HEADER_BILL_LOGO_FILE = req.file.filename 
//     }

//     //=== 2.) ถ้าอัปเดตหรือเพิ่มใหม่สำเร็จ
//     // - ลบของเท่าทั้งหมดก่อน
//     await collection.deleteMany({})
//     const rtn = await collection.insertOne(settingsData)
//     if(rtn.acknowledged){
//       req.flash("msg", { class:"green", text:`บันทึกการตั้งค่าบิลเงินสดเรียบร้อยแล้ว` })
//       res.redirect(redirect_Url)
//     }else{
//       req.flash("msg", { class:"red", text:`เกิดข้อผิดพลาดขณะบันทึกการตั้งค่าบิลเงินสด` })
//       res.redirect(redirect_Url)
//     }
//   } catch (err) {
//     console.log(err)
//     res.sendFile(file404)
//   } finally {
//     client.close()
//   }
// })

