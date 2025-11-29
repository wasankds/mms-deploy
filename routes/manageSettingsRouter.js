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
import archiver from 'archiver' // สำหรับสร้างไฟล์ zip
import path from 'path'
import fs from 'fs'  ;
import mainAuth from "../middleware/mainAuth.js"   ;
const myModule = await import(`../${mymoduleFolder}/myModule.js`)  ;
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)  ;
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)  ;
const PATH_MAIN = '/manage/settings'  ;
const PATH_SAVE = `${PATH_MAIN}/save`  ;
const PATH_BACKUP_DB = `${PATH_MAIN}/backup-db`
const PATH_UPDATE_SYSTEM = `${PATH_MAIN}/update-system`
const PATH_RESTART_PM2 = `${PATH_MAIN}/restart-pm2`
const PATH_DOWNLOAD_BACKUP = `${PATH_MAIN}/download-backup`
const PATH_REMOVE_BACKUP = `${PATH_MAIN}/remove-backup`
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

    //=== อ่านชื่อโฟลเดอร์ทั้งหมดใน backup
    // - เพื่อแสดงจำนวน backup ในหน้า settings
    const backupFolders = [];
    fs.readdirSync(global.folderBackup, { withFileTypes: true }).forEach(dir => {
      if (dir.isDirectory()) {
        backupFolders.push(dir.name);
      }
    });
    // console.log('backupFolders ===> ', backupFolders);

    const html = await myModule.renderView('manageSettings', res, {
      title : PAGE_MANAGE_SETTINGS ,
      time : myDateTime.getDate(),  
      msg : req.flash('msg'),
      user : myUsers.getSessionData(req),
      settings : await myModule.getSettings(),

      backupFolders,
      tabNumberClicked,

      PATH_MAIN,
      PATH_SAVE,
      PATH_RESTART_PM2,
      PATH_BACKUP_DB,
      PATH_UPDATE_SYSTEM,
      PATH_DOWNLOAD_BACKUP,      
      PATH_REMOVE_BACKUP,
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
    const dt = myDateTime.getDateTime().replace(/[: ]/g, '_');
    const backupDirName = `${global.dbName}_${dt}`;
    const backupDir = path.join(global.folderBackup, backupDirName);

    //=== ตรวจสอบว่าโฟลเดอร์ backup มีอยู่แล้วหรือไม่
    if (fs.existsSync(backupDir)) {
      req.flash('msg', {
        class: "yellow",
        text: `มีโฟลเดอร์แบ็คอัพชื่อ "${backupDirName}" อยู่แล้ว`
      });
      return res.redirect(path_redirect);
    }
    
    //=== รันคำสั่งจาก bash terminal
    const cmd = `mongodump --db ${global.dbName} --out "${backupDir}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        req.flash('msg', { 
          class: "red", 
          text: `Backup error: ${error.message}` 
        });
        return res.redirect(path_redirect);
      }
      const msg = `แบ็คอัพฐานข้อมูล "${global.dbName}" ไปยัง{{sep}}${backupDir}{{sep}}สำเร็จ`
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
// ห้ามลบ - สำหรับ backup แล้วลบของเก่า
//
router.post("backup-and-delete-old-all",  mainAuth.isOA , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  const path_redirect = `${PATH_MAIN}?tab=2`;
  try {
    // //=== รันคำสั่งจาก package.json ที่กำหนดไว้
    // const rootDir = process.cwd()
    // console.log('rootDir ===> ', rootDir);
    // สร้างชื่อโฟลเดอร์ backup ตามวันเวลา
    // const dt = DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm').replace(/[: ]/g, '-');
    const dt = myDateTime.getDateTime().replace(/[: ]/g, '-');
    const backupDir = path.join(global.folderBackup, `${dbName}_${dt}`);
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
      let msg = `แบ็คอัพฐานข้อมูล "${dbName}" สำเร็จ`;
      
      // อ่านไฟล์ใน backup directory
      fs.readdir(path.join(global.folderBackup), async (err, files) => {
        if (err) {
          console.log('Error reading backup directory:', err);
          req.flash('msg', { class: "green", text: msg });
          res.redirect(path_redirect);
          return;
        }

        // กรองไฟล์ที่ต้องลบ (ไม่ใช่ backup ล่าสุด)
        const filesToDelete = files.filter(file => file !== `${dbName}_${dt}`);
        
        // ไม่มีไฟล์ที่ต้องลบ
        if (filesToDelete.length === 0) {
          req.flash('msg', { class: "green", text: msg });
          res.redirect(path_redirect);
          return;
        }

        // ลบไฟล์ทีละตัวและรอให้เสร็จ
        const deletePromises = filesToDelete.map(file => {
          const filePath = path.join(global.folderBackup, file);
          return new Promise((resolve) => {
            fs.rm(filePath, { recursive: true, force: true }, (err) => {
              if (err) {
                // console.log(`Error deleting old backup folder ${file}:`, err);
                resolve(null); // ส่งกลับ null ถ้ามี error
              } else {
                // console.log(`Deleted old backup folder: ${file}`);
                resolve(file); // ส่งกลับชื่อไฟล์ที่ลบสำเร็จ
              }
            });
          });
        });
        // รอให้ลบไฟล์ทั้งหมดเสร็จ
        const deletedFiles = await Promise.all(deletePromises);
        
        // เพิ่มรายการไฟล์ที่ลบสำเร็จลงใน message
        deletedFiles.forEach(file => {
          if (file) {
            msg += `{{sep}}[ลบโฟลเดอร์เก่า: ${file}]`;
          }
        });
        req.flash('msg', { class: "green", text: msg });
        res.redirect(path_redirect);
      });
    });
  } catch (err) {
    console.log(err)
    req.flash('msg', { class:"red", text:err.message})
    res.redirect(path_redirect)
  }

})

//=======================================================
// ดาวน์โหลดโฟลเดอร์ backup เป็นไฟล์ zip
//
router.get(`${PATH_DOWNLOAD_BACKUP}/:folderName`,  mainAuth.isOA , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)
  // console.log("req.params ===> " , req.params)

  const path_redirect = `${PATH_MAIN}?tab=2`;
  try {

    // ตรวจสอบว่าโฟลเดอร์ backup ที่ระบุมีอยู่จริงหรือไม่
    const { folderName } =  req.params;
    const backupPath = path.join(global.folderBackup, folderName);
    if (!fs.existsSync(backupPath)) {
      req.flash('msg', {
        class: "red",
        text: `ไม่พบโฟลเดอร์แบ็คอัพที่ระบุ: ${folderName}`
      });
      return res.redirect(path_redirect);
    }

    // สร้างไฟล์ zip สำหรับดาวน์โหลด
    const zipFileName = `${folderName}.zip`;
    
    // ตั้งค่า response headers สำหรับการดาวน์โหลด
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    
    // สร้าง archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 } // ระดับการบีบอัด
    });
    
    // จัดการ error
    archive.on('error', (err) => {
      console.log('Archive error:', err);
      if (!res.headersSent) {
        req.flash('msg', {
          class: "red",
          text: `เกิดข้อผิดพลาดในการสร้างไฟล์ zip: ${err.message}`
        });
        return res.redirect(path_redirect);
      }
    });
    
    // เมื่อ archive เสร็จสิ้น
    archive.on('end', () => {
      console.log(`Archive created successfully: ${archive.pointer()} total bytes`);
    });
    
    // ส่ง archive stream ไปยัง response
    archive.pipe(res);    
    // เพิ่มโฟลเดอร์ลงใน archive
    archive.directory(backupPath, false);    
    // เสร็จสิ้นการสร้าง archive
    archive.finalize();
    // ถ้ามีการดาวน์โหลดสำเร็จ จะไม่ต้องทำอะไรเพิ่มเติมที่นี่
  } catch (err) {
    console.log(err)
    req.flash('msg', { class:"red", text:err.message})
    res.redirect(path_redirect)
  }
})

//=======================================================
// ลบโฟลเดอร์ backup ที่ระบุ
//
router.get(`${PATH_REMOVE_BACKUP}/:folderName`,  mainAuth.isOA , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)
  // console.log("req.params ===> " , req.params)

  const path_redirect = `${PATH_MAIN}?tab=2`;
  try {

    // ตรวจสอบว่าโฟลเดอร์ backup ที่ระบุมีอยู่จริงหรือไม่
    const { folderName } =  req.params;
    const backupPath = path.join(global.folderBackup, folderName);
    if (!fs.existsSync(backupPath)) {
      req.flash('msg', {
        class: "red",
        text: `ไม่พบโฟลเดอร์แบ็คอัพที่ระบุ: ${folderName}`
      });
      return res.redirect(path_redirect);
    }

    // ลบโฟลเดอร์ backup ที่ระบุ
    fs.rm(backupPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('Error deleting backup folder:', err);
        req.flash('msg', {
          class: "red",
          text: `เกิดข้อผิดพลาดในการลบโฟลเดอร์แบ็คอัพ: ${err.message}`
        });
        return res.redirect(path_redirect);
      }
      req.flash('msg', {
        class: "green",
        text: `ลบโฟลเดอร์แบ็คอัพสำเร็จ: ${folderName}`
      });
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

    //== ตรวจสอบชื่อ process ที่ต้องการ (เช่น 'mms')
    const processName = 'mms';
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





//=======================================================
// //
// router.post(PATH_BACKUP_DB,  mainAuth.isOA , async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log("req.body ===> " , req.body)

//   const path_redirect = `${PATH_MAIN}?tab=2`;
//   try {
//     // //=== รันคำสั่งจาก package.json ที่กำหนดไว้
//     // const rootDir = process.cwd()
//     // console.log('rootDir ===> ', rootDir);
//     // สร้างชื่อโฟลเดอร์ backup ตามวันเวลา
//     // const dt = DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm').replace(/[: ]/g, '-');
//     const dt = myDateTime.getDateTime().replace(/[: ]/g, '-');
//     const backupDir = path.join(global.folderBackup, `${dbName}_${dt}`);
//     const cmd = `mongodump --db ${dbName} --out "${backupDir}"`;
//     // console.log('rootDir ===> ', rootDir);
//     // console.log('cmd ===> ', cmd);
//     // rootDir ===>  D:\aWK_LeaseSystem\DC4
//     // cmd ===>  mongodump --db docsCreator --out "D:\aWK_LeaseSystem\DC4\backup\docsCreator_2025-08-31-08-39"

//     exec(cmd, (error, stdout, stderr) => {
//       if (error) {
//         req.flash('msg', { 
//           class: "red", 
//           text: `Backup error: ${error.message}` 
//         });
//         return res.redirect(path_redirect);
//       }

//       //=== ลบโฟลเดอร์อื่นๆ ในโฟลเดอร์ backup ที่ไม่ใช่ backup ล่าสุดออกไป 
//       let msg = `แบ็คอัพฐานข้อมูล "${dbName}" สำเร็จ`;
      
//       // อ่านไฟล์ใน backup directory
//       fs.readdir(path.join(global.folderBackup), async (err, files) => {
//         if (err) {
//           console.log('Error reading backup directory:', err);
//           req.flash('msg', { class: "green", text: msg });
//           res.redirect(path_redirect);
//           return;
//         }

//         // กรองไฟล์ที่ต้องลบ (ไม่ใช่ backup ล่าสุด)
//         const filesToDelete = files.filter(file => file !== `${dbName}_${dt}`);
        
//         // ไม่มีไฟล์ที่ต้องลบ
//         if (filesToDelete.length === 0) {
//           req.flash('msg', { class: "green", text: msg });
//           res.redirect(path_redirect);
//           return;
//         }

//         // ลบไฟล์ทีละตัวและรอให้เสร็จ
//         const deletePromises = filesToDelete.map(file => {
//           const filePath = path.join(global.folderBackup, file);
//           return new Promise((resolve) => {
//             fs.rm(filePath, { recursive: true, force: true }, (err) => {
//               if (err) {
//                 // console.log(`Error deleting old backup folder ${file}:`, err);
//                 resolve(null); // ส่งกลับ null ถ้ามี error
//               } else {
//                 // console.log(`Deleted old backup folder: ${file}`);
//                 resolve(file); // ส่งกลับชื่อไฟล์ที่ลบสำเร็จ
//               }
//             });
//           });
//         });
//         // รอให้ลบไฟล์ทั้งหมดเสร็จ
//         const deletedFiles = await Promise.all(deletePromises);
        
//         // เพิ่มรายการไฟล์ที่ลบสำเร็จลงใน message
//         deletedFiles.forEach(file => {
//           if (file) {
//             msg += `{{sep}}[ลบโฟลเดอร์เก่า: ${file}]`;
//           }
//         });
//         req.flash('msg', { class: "green", text: msg });
//         res.redirect(path_redirect);
//       });
//     });
//   } catch (err) {
//     console.log(err)
//     req.flash('msg', { class:"red", text:err.message})
//     res.redirect(path_redirect)
//   }

// })
