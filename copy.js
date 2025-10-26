import fs from 'fs';
import path from 'path';

//=== โฟลเดอร์เก็บโปรเจกต์
const __dirname = path.dirname(new URL(import.meta.url).pathname);
let destProjectDir = __dirname;
if (destProjectDir.startsWith('/') && /^[A-Za-z]:/.test(destProjectDir.slice(1, 3))) {
  destProjectDir = destProjectDir.slice(1);
}
console.log(`------------------------------`);
console.log('destProjectDir ===> ' , destProjectDir); // D:/aWK_LeaseSystem/MMS-Deploy

//=== โฟลเดอร์ต้นทางที่จะก๊อปปี้
const sourceProject = 'D:\\aWK_LeaseSystem\\MMS';


//=== โฟลเดอร์ที่จะก๊อปปี้ ใช้กับทั้งต้นทาง และ ปลายทาง
const folderNames = [
  // โฟลเดอร์ระบบ
  'middleware', 'routes-min', 'mymodule-min',  'views',  'commandSystem-min',
  // โฟลเดอร์ public แยกย่อยด้วย 
  'public/cdn', 'public/css-min', 'public/fonts', 'public/images', 'public/js-min', 'public/static', 'public/sounds', 
  // โฟลเดอร์สำหรับเก็บข้อมูลเอนทิตี้ - ไม่เอา backup เพราะจะสำรองข้อมูลแยกกัน 
  // 'items', 'warehouse-in', 'warehouse-out' ,'sales', 'return'
];

//=== ไฟล์ที่จะก๊อปปี้ ใช้กับทั้งต้นทาง และ ปลายทาง 
// - .gitignore ไฟล์นี้ไม่ต้องก๊อปปี้
const fileNames = [
  'mms.js',
  'package.json', 
  'README.md',   
  '.env-deploy',  
  '1_start.bat',
  '2_restart.bat',
  '3_delete.bat',
  '4_kill-win.bat',
  // '5_kill-linux.bat', 
];

//=== สร้าางตัวแปรใหม่ที่มีโครงสร้าง
//  { copyType: 'folder' | 'file', source: 'path', destination: 'path' }
// 
const sourceDir = [
  ...folderNames.map(name => ({
    copyType: 'folder',
    source: path.join(sourceProject, name),
    destination: path.join(destProjectDir, name)
  })),
  ...fileNames.map(name => ({
    copyType: 'file',
    source: path.join(sourceProject, name),
    destination: path.join(destProjectDir, name)
  }))
];


let i=0
for (const obj of sourceDir) {
  const { copyType, source, destination } = obj;
  if (copyType === 'folder') {
    copyFolderRecursiveSync(source, destination);
  } else if (copyType === 'file') {
    fs.copyFileSync(source, destination);
  }
  console.log(`---------------------------------------`);
  console.log(`Copied [${copyType}] ${source} -> ${destination}`);
}

//==============================================
// ฟังก์ชันสำหรับการก๊อปปี้โฟลเดอร์แบบ recursive ***
// - ก๊อปปี้โฟลเดอร์ ย่อยและไฟล์ภายในด้วย 
// 
function copyFolderRecursiveSync(src, dest) {
  i++;
  console.log(`${i}). Copying from ${src} ===> ${dest}`);
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}


