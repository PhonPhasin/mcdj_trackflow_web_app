import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, doc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, query, orderBy, limit 
} from 'firebase/firestore';
import { 
  getStorage, ref, uploadBytesResumable, getDownloadURL 
} from "firebase/storage";
import { 
  Lock, Mail, LogOut, CheckCircle, AlertTriangle, 
  Send, Loader2, Search, FileText, Camera, Paperclip, MessageSquare,
  LayoutDashboard, Users, X, Plus, Calendar as CalendarIcon, Trash2, Globe, MessageCircle, ChevronLeft, Download, Image as ImageIcon,
  Clock
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyCPFU_HubJHRibKpkKBxNVRVLUX1vACKG8",
  authDomain: "mcdjwatrackflow.firebaseapp.com",
  projectId: "mcdjwatrackflow",
  storageBucket: "mcdjwatrackflow.firebasestorage.app",
  messagingSenderId: "75320106206",
  appId: "1:75320106206:web:1c30c9dbce98ce974fb64f",
  measurementId: "G-421DEJT06S"
};

const LINE_WEBHOOK_URL = "https://asia-southeast1-mcdjwatrackflow.cloudfunctions.net/sendLineNotification";
const LIFF_ID = "2010475900-0hTYAPSL"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const TASK_TYPES = [
  'พิจารณาปีแรก ประกันรายเดี่ยว',
  'พิจารณาปีแรก ประกันกลุ่ม',
  'ติดตามสินไหม ประกันกลุ่ม / ประกันรายเดี่ยว',
  'ติดตามเอกสาร AIA',
  'ติดตาม ประกันวินาศภัย',
  'ติดตาม อสังหาริมทรัพย์',
  'อื่นๆ'
];

const KANBAN_COLUMNS = [
  { id: 'Pending', tKey: 'statusPending', badgeColor: 'bg-yellow-400' },
  { id: 'In Progress', tKey: 'statusInProgress', badgeColor: 'bg-sky-400' },
  { id: 'Rejected', tKey: 'statusRejected', badgeColor: 'bg-red-400' },
  { id: 'Approved', tKey: 'statusApproved', badgeColor: 'bg-green-400' }
];

const MONTHS = [
  { val: '01', label: 'มกราคม' }, { val: '02', label: 'กุมภาพันธ์' },
  { val: '03', label: 'มีนาคม' }, { val: '04', label: 'เมษายน' }, { val: '05', label: 'พฤษภาคม' },
  { val: '06', label: 'มิถุนายน' }, { val: '07', label: 'กรกฎาคม' }, { val: '08', label: 'สิงหาคม' },
  { val: '09', label: 'กันยายน' }, { val: '10', label: 'ตุลาคม' }, { val: '11', label: 'พฤศจิกายน' },
  { val: '12', label: 'ธันวาคม' }
];

const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = ['all'];
  const maxYear = Math.max(currentYear + 1, 2027);
  for (let y = maxYear; y >= 2026; y--) years.push(y.toString());
  return years;
};
const YEARS = generateYears();

const generateTrackingId = (tasks) => {
  let maxId = 'M96A000';
  tasks.forEach(t => {
    const tid = t.trackingId;
    if (tid && tid.startsWith('M96') && tid > maxId) maxId = tid;
  });
  if (maxId === 'M96A000') return 'M96A001';
  const letter = maxId.charAt(3);
  const numStr = maxId.substring(4);
  let num = parseInt(numStr, 10);
  let nextLetter = letter;
  num += 1;
  if (num > 999) { num = 1; nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1); }
  return `M96${nextLetter}${String(num).padStart(3, '0')}`;
};

const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

const translations = {
  TH: {
    login: 'เข้าสู่ระบบ', email: 'อีเมลบัญชีผู้ใช้', pass: 'รหัสผ่าน',
    faView: 'หน้าบ้าน (FA)', adminView: 'หลังบ้าน (Admin)', execView: 'ผู้บริหาร (Exec)',
    myTasks: 'รายการของฉัน', calendar: 'ปฏิทินการทำงาน', taskBoard: 'กระดานจัดการงาน',
    allTasks: 'ตารางสรุปงานทั้งหมด', privateTask: 'งานส่วนตัว (FA)', backendTask: 'ส่งหลังบ้าน',
    createTask: 'สร้างรายการ / ยื่นงาน',
    statusPending: 'รอรับเรื่อง', statusInProgress: 'กำลังดำเนินการ', statusRejected: 'ส่งกลับแก้ไข', statusApproved: 'เสร็จสิ้นแล้ว',
    colClient: 'ชื่อลูกค้า / ชื่องาน *', colType: 'ประเภทงาน', colDue: 'กำหนดส่งงาน', colFa: 'ผู้รับผิดชอบ', colManage: 'จัดการ',
    viewData: 'ดูข้อมูล', totalTasks: 'งานทั้งหมด', clientName: 'ชื่อลูกค้า / ชื่องาน *',
    policyNumber: 'เลขกรมธรรม์ / เลขที่อ้างอิง', 
    serviceType: 'ประเภทงาน', dueDate: 'กำหนดส่งงาน', urgency: 'ความเร่งด่วน', normal: 'ปกติ', urgent: 'ด่วน 🔥',
    details: 'รายละเอียดเพิ่มเติม...', attach: 'ถ่ายรูป หรือ แนบไฟล์ PDF', submit: 'ส่งคำขอ', empty: 'ว่างเปล่า',
    personal: 'ส่วนตัว', company: 'บริษัท', assignTask: 'สั่งมอบหมายงาน',
    assignTo: 'มอบหมายให้ (FA/Admin) *', selectFa: '-- เลือกผู้รับผิดชอบ --', orderDetails: 'รายละเอียด / ข้อความสั่งงาน', confirmAssign: 'ยืนยันมอบหมายงาน',
    searchClient: 'ค้นหาชื่อลูกค้า...', allFa: 'ทุก FA', everyMonth: 'ทุกเดือน', everyYear: 'ทุกปี',
    chatHistory: 'การสนทนา & บันทึก', typeMessage: 'พิมพ์ข้อความ...',
    pdfReport: 'รายงานสรุปงานและประวัติการติดตาม', refCode: 'รหัสอ้างอิง', taskInfo: '1. ข้อมูลงาน (Task Details)',
    currentStatus: 'สถานะปัจจุบัน', createDate: 'วันที่สร้างรายการ', attachFiles: '2. รูปภาพแนบ (Attachments)',
    savePdf: 'บันทึกเป็น PDF', uploading: 'กำลังเตรียมไฟล์...', back: 'กลับ', taskDetails: 'ข้อมูลคำขอ', updateStatus: 'อัปเดตสถานะงาน',
    chatTitle: 'แชทส่วนตัว & กลุ่ม', staffList: 'รายชื่อบุคลากร', noStaff: 'ยังไม่มีรายชื่อบุคลากร',
    startChat: 'เริ่มการสนทนา', attachFileText: 'กดเพื่อแนบไฟล์', downloadAttach: 'ดาวน์โหลดไฟล์แนบ', noChatHistory: 'ไม่มีประวัติการพูดคุย',
    dashboard: 'แดชบอร์ด', deleteTask: 'ลบงานนี้', confirmDelete: 'ยืนยันการลบ?', cancel: 'ยกเลิก', deletePermanent: 'ลบถาวร',
    'พิจารณาปีแรก ประกันรายเดี่ยว': 'พิจารณาปีแรก ประกันรายเดี่ยว',
    'พิจารณาปีแรก ประกันกลุ่ม': 'พิจารณาปีแรก ประกันกลุ่ม',
    'ติดตามสินไหม ประกันกลุ่ม / ประกันรายเดี่ยว': 'ติดตามสินไหม ประกันกลุ่ม / ประกันรายเดี่ยว',
    'ติดตามเอกสาร AIA': 'ติดตามเอกสาร AIA',
    'ติดตาม ประกันวินาศภัย': 'ติดตาม ประกันวินาศภัย',
    'ติดตาม อสังหาริมทรัพย์': 'ติดตาม อสังหาริมทรัพย์',
    'อื่นๆ': 'อื่นๆ',
    sun: 'อา', mon: 'จ', tue: 'อ', wed: 'พ', thu: 'พฤ', fri: 'ศ', sat: 'ส',
    month01: 'มกราคม', month02: 'กุมภาพันธ์', month03: 'มีนาคม', month04: 'เมษายน', month05: 'พฤษภาคม', month06: 'มิถุนายน', month07: 'กรกฎาคม', month08: 'สิงหาคม', month09: 'กันยายน', month10: 'ตุลาคม', month11: 'พฤศจิกายน', month12: 'ธันวาคม',
    addEventTitle: 'เพิ่มกิจกรรม', eventNameInput: 'ชื่อกิจกรรม...', personalEvent: 'กิจกรรมส่วนตัว', companyEvent: 'กิจกรรมบริษัท', saveEventBtn: 'บันทึกกิจกรรม',
    execSubtitle: 'รายงานสรุปผลการปฏิบัติงานติดตาม',
    daysLeft: 'เหลือ', overdue: 'เลยกำหนด', days: 'วัน',
    linkLine: 'เชื่อมต่อ LINE', lineLinked: 'เชื่อมต่อ LINE แล้ว',
    startTime: 'เวลาเริ่ม', endTime: 'เวลาสิ้นสุด'
  },
  EN: {
    login: 'Sign In', email: 'Email Address', pass: 'Password',
    faView: 'Front (FA)', adminView: 'Admin', execView: 'Executive',
    myTasks: 'My Tasks', calendar: 'Calendar', taskBoard: 'Task Board',
    allTasks: 'All Tasks Summary', privateTask: 'Private (FA)', backendTask: 'Send to Back-office',
    createTask: 'Create Task',
    statusPending: 'Pending', statusInProgress: 'In Progress', statusRejected: 'Rejected', statusApproved: 'Completed',
    colClient: 'Client / Task *', colType: 'Service Type', colDue: 'Due Date', colFa: 'Assignee', colManage: 'Action',
    viewData: 'View', totalTasks: 'Total Tasks', clientName: 'Client Name *',
    policyNumber: 'Policy Number / Ref. No', 
    serviceType: 'Service Type', dueDate: 'Due Date', urgency: 'Urgency', normal: 'Normal', urgent: 'Urgent 🔥',
    details: 'More details...', attach: 'Upload Photo or PDF', submit: 'Submit', empty: 'Empty',
    personal: 'Personal', company: 'Company', assignTask: 'Assign Task',
    assignTo: 'Assign to (FA/Admin) *', selectFa: '-- Select Assignee --', orderDetails: 'Order Details', confirmAssign: 'Confirm Assign',
    searchClient: 'Search client...', allFa: 'All FAs', everyMonth: 'All Months', everyYear: 'All Years',
    chatHistory: 'Chat & Notes', typeMessage: 'Type message...',
    pdfReport: 'Task Report & Tracking History', refCode: 'Ref. Code', taskInfo: '1. Task Details',
    currentStatus: 'Current Status', createDate: 'Created Date', attachFiles: '2. Attachments',
    savePdf: 'Save as PDF', uploading: 'Preparing file...', back: 'Back', taskDetails: 'Task Info', updateStatus: 'Update Status',
    chatTitle: 'Direct Messages', staffList: 'Staff List', noStaff: 'No staff available',
    startChat: 'Start chatting', attachFileText: 'Click to attach', downloadAttach: 'Download Attachment', noChatHistory: 'No chat history',
    dashboard: 'Dashboard', deleteTask: 'Delete Task', confirmDelete: 'Confirm Delete?', cancel: 'Cancel', deletePermanent: 'Delete Permanent',
    'พิจารณาปีแรก ประกันรายเดี่ยว': 'First Year - Individual Life',
    'พิจารณาปีแรก ประกันกลุ่ม': 'First Year - Group Life',
    'ติดตามสินไหม ประกันกลุ่ม / ประกันรายเดี่ยว': 'Claim - Group / Individual',
    'ติดตามเอกสาร AIA': 'Follow up AIA Docs',
    'ติดตาม ประกันวินาศภัย': 'Follow up Non-Life Insurance',
    'ติดตาม อสังหาริมทรัพย์': 'Follow up Real Estate',
    'อื่นๆ': 'Others',
    sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
    month01: 'January', month02: 'February', month03: 'March', month04: 'April', month05: 'May', month06: 'June', month07: 'July', month08: 'August', month09: 'September', month10: 'October', month11: 'November', month12: 'December',
    addEventTitle: 'Add Event', eventNameInput: 'Event Name...', personalEvent: 'Personal Event', companyEvent: 'Company Event', saveEventBtn: 'Save Event',
    execSubtitle: 'Task Performance Summary Report',
    daysLeft: 'Remaining', overdue: 'Overdue', days: 'days',
    linkLine: 'Connect LINE', lineLinked: 'LINE Connected',
    startTime: 'Start Time', endTime: 'End Time'
  },
  JP: {
    login: 'ログイン', email: 'メールアドレス', pass: 'パスワード',
    faView: 'フロント (FA)', adminView: '管理 (Admin)', execView: '幹部 (Exec)',
    myTasks: 'マイタスク', calendar: 'カレンダー', taskBoard: 'タスクボード',
    allTasks: '全タスク', privateTask: '個人 (FA)', backendTask: 'バックオフィスへ',
    createTask: 'タスク作成',
    statusPending: '保留中', statusInProgress: '進行中', statusRejected: '却下', statusApproved: '完了',
    colClient: '顧客 / タスク *', colType: 'サービス', colDue: '期日', colFa: '担当者', colManage: 'アクション',
    viewData: '詳細', totalTasks: '全タスク', clientName: '顧客名 *',
    policyNumber: '証券番号 / 参照番号', 
    serviceType: 'サービス', dueDate: '期日', urgency: '緊急度', normal: '通常', urgent: '緊急 🔥',
    details: '詳細...', attach: '写真またはPDF', submit: '送信', empty: '空',
    personal: '個人', company: '会社', assignTask: 'タスク割り当て',
    assignTo: '担当者 (FA/Admin) *', selectFa: '-- 選択 --', orderDetails: 'タスク詳細', confirmAssign: '割り当て確認',
    searchClient: '顧客検索...', allFa: '全員', everyMonth: '全月', everyYear: '全年',
    chatHistory: 'チャット履歴', typeMessage: 'メッセージ入力...',
    pdfReport: 'タスクレポートと追跡履歴', refCode: '参照コード', taskInfo: '1. タスク詳細',
    currentStatus: '現在のステータス', createDate: '作成日', attachFiles: '2. 添付ファイル',
    savePdf: 'PDFとして保存', uploading: '準備中...', back: '戻る', taskDetails: 'タスク情報', updateStatus: 'ステータส更新',
    chatTitle: 'ダイレクトメッセージ', staffList: 'スタッフリスト', noStaff: 'スタッフがいません',
    startChat: 'チャット開始', attachFileText: 'クリックして添付', downloadAttach: '添付ファイルをダウンロード', noChatHistory: 'チャット履歴なし',
    dashboard: 'ダッシュボード', deleteTask: 'タスク削除', confirmDelete: '削除しますか？', cancel: 'キャンセル', deletePermanent: '永久削除',
    'พิจารณาปีแรก ประกันรายเดี่ยว': '初年度 - 個人生命保険',
    'พิจารณาปีแรก ประกันกลุ่ม': '初年度 - グループ生命保険',
    'ติดตามสินไหม ประกันกลุ่ม / ประกันรายเดี่ยว': '請求 - グループ / 個人',
    'ติดตามเอกสาร AIA': 'AIA書類フォローアップ',
    'ติดตาม ประกันวินาศภัย': '損害保険フォローアップ',
    'ติดตาม อสังหาริมทรัพย์': '不動産フォローアップ',
    'อื่นๆ': 'その他',
    sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土',
    month01: '1月', month02: '2月', month03: '3月', month04: '4月', month05: '5月', month06: '6月', month07: '7月', month08: '8月', month09: '9月', month10: '10月', month11: '11月', month12: '12月',
    addEventTitle: 'イベント追加', eventNameInput: 'イベント名...', personalEvent: '個人イベント', companyEvent: '会社イベント', saveEventBtn: 'イベントを保存',
    execSubtitle: 'タスクパフォーマンス概要レポート',
    daysLeft: '残り', overdue: '期限切れ', days: '日',
    linkLine: 'LINE 連携', lineLinked: 'LINE 連携済み',
    startTime: '開始時間', endTime: '終了時間'
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState("front"); 
  const [faSubTab, setFaSubTab] = useState("tasks"); 
  const [adminSubTab, setAdminSubTab] = useState("tasks"); 
  const [execSubTab, setExecSubTab] = useState("dashboard"); 
  const [calendarFilter, setCalendarFilter] = useState("personal"); 
  
  const [language, setLanguage] = useState("TH");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const t = (key) => translations[language]?.[key] || translations['TH'][key] || key;

  const [toastMessage, setToastMessage] = useState(null);
  const [selectedTaskModal, setSelectedTaskModal] = useState(null);
  const [pdfTask, setPdfTask] = useState(null);
  const [isDownloadingInfo, setIsDownloadingInfo] = useState(false);
  const [isDownloadingImages, setIsDownloadingImages] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false); 
  const [hideImagesForPdf, setHideImagesForPdf] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const [frontFormMode, setFrontFormMode] = useState("backend"); 
  const [frontListMode, setFrontListMode] = useState("backend");

  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const [clientName, setClientName] = useState("");
  const [policyNumber, setPolicyNumber] = useState(""); 
  const [serviceType, setServiceType] = useState(TASK_TYPES[0]);
  const [urgency, setUrgency] = useState("ปกติ"); 
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [filesToUpload, setFilesToUpload] = useState([]); 
  const [submittingTask, setSubmittingTask] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ faUid: "", clientName: "", policyNumber: "", serviceType: TASK_TYPES[0], urgency: "ปกติ", notes: "", dueDate: "" }); 
  const [assignFilesToUpload, setAssignFilesToUpload] = useState([]);
  const [assigningTask, setAssigningTask] = useState(false);

  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [eventForm, setEventForm] = useState({ title: "", type: "personal", color: "blue", startTime: "", endTime: "" });

  const [actionLoading, setActionLoading] = useState({});
  const [chatInputs, setChatInputs] = useState({});
  const [isUploadingChatFile, setIsUploadingChatFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFaFilter, setSelectedFaFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  
  const [dbUsers, setDbUsers] = useState([]);
  const [isDmOpen, setIsDmOpen] = useState(false);
  const [dmView, setDmView] = useState("list");
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState("");
  const [isUploadingDmFile, setIsUploadingDmFile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  const dmChatEndRef = useRef(null);
  const taskChatEndRef = useRef(null);
  const prevDmCountRef = useRef(0);
  const [isLiffReady, setIsLiffReady] = useState(false);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const notifyLine = async (type, data, targetFaUid) => {
    try {
      await fetch(LINE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, targetFaUid })
      });
    } catch (error) {
      console.error("LINE Webhook Error:", error);
    }
  };

  useEffect(() => {
    if (!LIFF_ID || LIFF_ID === "วางรหัส LIFF ID ของคุณตรงนี้") return;

    const script = document.createElement('script');
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    script.async = true;
    script.onload = () => {
      window.liff.init({ liffId: LIFF_ID })
        .then(() => {
          setIsLiffReady(true);
          if (window.liff.isLoggedIn() && user) {
            window.liff.getProfile().then(async profile => {
              try {
                await updateDoc(doc(db, 'users', user.uid), {
                  lineUserId: profile.userId,
                  lineDisplayName: profile.displayName
                });
                showToast("เชื่อมต่อ LINE สำเร็จ!");
                setUserProfile(prev => ({...prev, lineUserId: profile.userId}));
                window.liff.logout(); 
              } catch (e) { console.error(e); }
            });
          }
        })
        .catch(err => console.error("LIFF Init Error:", err));
    };
    document.body.appendChild(script);
    
    return () => { if (document.body.contains(script)) document.body.removeChild(script); }
  }, [user]);

  const handleLinkLine = () => {
    if (!isLiffReady || !window.liff) return showToast("กำลังโหลดบริการ LINE...", "error");
    if (!window.liff.isLoggedIn()) {
      window.liff.login({ redirectUri: window.location.href });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserProfile(data);
            if (data.role === 'Executive') setActiveTab('dashboard');
            else if (data.role === 'Admin') setActiveTab('back');
            else setActiveTab('front');
          } else {
            setUserProfile({ name: currentUser.email.split('@')[0], role: 'FA', email: currentUser.email });
            setActiveTab('front');
          }
        } catch (e) { console.error(e); }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users');
    const unsub = onSnapshot(q, (snap) => {
      const usersList = [];
      snap.forEach(doc => { if(doc.id !== user.uid) usersList.push({ uid: doc.id, ...doc.data() }); });
      setDbUsers(usersList);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !userProfile) return;
    const qTasks = collection(db, 'tasks');
    const unsub = onSnapshot(qTasks, (snap) => {
      const taskList = [];
      snap.forEach(d => taskList.push({ id: d.id, ...d.data() }));
      taskList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTasks(taskList);
      if (selectedTaskModal) {
        const updated = taskList.find(t => t.id === selectedTaskModal.id);
        const isNewMessage = updated?.messages?.length !== selectedTaskModal?.messages?.length;
        setSelectedTaskModal(updated || null);
        
        if (isNewMessage) {
          setTimeout(() => taskChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      }
      if (pdfTask) {
        const updated = taskList.find(t => t.id === pdfTask.id);
        setPdfTask(updated || null);
      }
    });
    const qEvents = collection(db, 'events');
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      const eventList = [];
      snap.forEach(d => eventList.push({ id: d.id, ...d.data() }));
      setEvents(eventList);
    });
    return () => { unsub(); unsubEvents(); };
  }, [user, userProfile, selectedTaskModal, pdfTask]);

  useEffect(() => {
    if (!activeChatUser || !user) return;
    const chatId = getChatId(user.uid, activeChatUser.uid);
    const qMsg = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
    const unSubDm = onSnapshot(qMsg, (snap) => {
      let list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setDmMessages(list);
      
      if (list.length !== prevDmCountRef.current) {
        setTimeout(() => dmChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        prevDmCountRef.current = list.length;
      }

      if (isDmOpen && dmView === 'chat') {
        list.forEach(m => {
          if (m.senderId !== user.uid && !m.isRead) updateDoc(doc(db, `chats/${chatId}/messages`, m.id), { isRead: true });
        });
      }
    });
    return () => unSubDm();
  }, [activeChatUser, user, isDmOpen, dmView]);

  useEffect(() => {
    if (!user || dbUsers.length === 0) return;
    const unsubs = dbUsers.map(chatUser => {
      const chatId = getChatId(user.uid, chatUser.uid);
      const qMsg = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'desc'), limit(1));
      return onSnapshot(qMsg, (snap) => {
        if (!snap.empty) {
          const lastMsg = snap.docs[0].data();
          if (lastMsg.senderId !== user.uid && !lastMsg.isRead) setUnreadCounts(prev => ({ ...prev, [chatUser.uid]: true }));
          else setUnreadCounts(prev => ({ ...prev, [chatUser.uid]: false }));
        }
      });
    });
    return () => unsubs.forEach(fn => fn());
  }, [user, dbUsers]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setSigningIn(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), password); } 
    catch (e) { showToast("อีเมลหรือรหัสผ่านไม่ถูกต้อง", "error"); } 
    finally { setSigningIn(false); }
  };

  const handleFileChange = (e, isAssign = false) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.size <= 5 * 1024 * 1024);
      if (isAssign) setAssignFilesToUpload(p => [...p, ...newFiles]);
      else setFilesToUpload(p => [...p, ...newFiles]);
    }
    e.target.value = null;
  };

  const removeFile = (idx, isAssign = false) => {
    if (isAssign) setAssignFilesToUpload(p => p.filter((_, i) => i !== idx));
    else setFilesToUpload(p => p.filter((_, i) => i !== idx));
  };

  const uploadFiles = async (files, setProgress) => {
    let urls = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const refName = `attachments/${Date.now()}_${file.name}`;
      const uploadTask = uploadBytesResumable(ref(storage, refName), file);
      const url = await new Promise((res, rej) => {
        uploadTask.on('state_changed', 
          (snap) => { if(setProgress) setProgress(Math.round(((i + (snap.bytesTransferred / snap.totalBytes)) / files.length) * 100)); }, 
          rej, 
          async () => res(await getDownloadURL(uploadTask.snapshot.ref))
        );
      });
      urls.push({ url, name: file.name, type: file.type });
    }
    return urls;
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!clientName || !serviceType) return showToast("กรุณากรอกข้อมูลให้ครบ", "error");
    setSubmittingTask(true);
    try {
      const attachments = await uploadFiles(filesToUpload, setUploadProgress);
      let msgs = [];
      if (notes.trim()) msgs.push({ text: notes.trim(), senderName: userProfile?.name || 'FA', senderRole: 'FA', timestamp: new Date().toISOString() });
      const taskData = {
        trackingId: generateTrackingId(tasks),
        clientName: clientName.trim(),
        policyNumber: policyNumber.trim(), 
        serviceType, urgency, dueDate,
        attachments, status: "Pending", formMode: frontFormMode,
        faUid: user.uid, faName: userProfile?.name || 'FA',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messages: msgs
      };
      await addDoc(collection(db, 'tasks'), taskData);
      setClientName(""); setPolicyNumber(""); setNotes(""); setDueDate(""); setFilesToUpload([]); setUploadProgress(0); 
      showToast("ยื่นงานสำเร็จเรียบร้อย!");

      // 🔔 ยื่นงานส่งหลังบ้าน (ให้แจ้งเตือนแอดมินและผู้บริหารทุกคน)
      if (frontFormMode === 'backend') {
        notifyLine('ASSIGN_TASK', taskData, 'ADMIN_OR_ALL');
      }
    } catch (e) { showToast("เกิดข้อผิดพลาดในการยื่นงาน", "error"); }
    finally { setSubmittingTask(false); }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.clientName || !assignForm.faUid) return showToast("กรุณากรอกข้อมูลให้ครบ", "error");
    setAssigningTask(true);
    try {
      const attachments = await uploadFiles(assignFilesToUpload, setUploadProgress);
      const targetFa = allAvailableFAs.find(f => f.uid === assignForm.faUid);
      let msgs = [];
      if (assignForm.notes.trim()) {
        const roleName = userProfile?.role === 'Admin' ? 'แอดมิน' : 'ผู้บริหาร';
        msgs.push({ text: `[${roleName}มอบหมายงาน]: ${assignForm.notes.trim()}`, senderName: userProfile?.name, senderRole: userProfile?.role, timestamp: new Date().toISOString() });
      }
      const taskData = {
        trackingId: generateTrackingId(tasks),
        clientName: assignForm.clientName.trim(),
        policyNumber: assignForm.policyNumber.trim(), 
        serviceType: assignForm.serviceType, urgency: assignForm.urgency, dueDate: assignForm.dueDate,
        attachments, status: "Pending", formMode: 'backend',
        faUid: targetFa.uid, faName: targetFa.name,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messages: msgs
      };
      await addDoc(collection(db, 'tasks'), taskData);

      notifyLine('ASSIGN_TASK', taskData, targetFa.uid);

      setAssignForm({ faUid: "", clientName: "", policyNumber: "", serviceType: TASK_TYPES[0], urgency: "ปกติ", notes: "", dueDate: "" }); 
      setAssignFilesToUpload([]); setShowAssignModal(false); setUploadProgress(0);
      showToast("มอบหมายงานสำเร็จ!");
    } catch (e) { showToast("เกิดข้อผิดพลาดในการมอบหมายงาน", "error"); }
    finally { setAssigningTask(false); }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    setActionLoading(p => ({ ...p, [`status-${taskId}`]: true }));
    try { 
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus, updatedAt: new Date().toISOString() }); 
      
      notifyLine('UPDATE_STATUS', {
        clientName: selectedTaskModal.clientName,
        newStatus: newStatus
      }, selectedTaskModal.faUid);

    } finally { setActionLoading(p => ({ ...p, [`status-${taskId}`]: false })); }
  };

  // 🔄 ฟังก์ชันใหม่: สำหรับเปลี่ยนผู้รับผิดชอบงาน
  const handleChangeAssignee = async (taskId, newFaUid) => {
    if (!newFaUid) return;
    const targetFa = allAvailableFAs.find(f => f.uid === newFaUid);
    if (!targetFa) return;

    setActionLoading(p => ({ ...p, [`assignee-${taskId}`]: true }));
    try {
      const msg = {
        text: `[ระบบ] ผู้บริหาร/แอดมิน ได้โอนย้ายงานนี้ให้: ${targetFa.name} เป็นผู้รับผิดชอบต่อ`,
        senderName: userProfile?.name || 'System',
        senderRole: userProfile?.role || 'Admin',
        timestamp: new Date().toISOString()
      };

      await updateDoc(doc(db, 'tasks', taskId), {
        faUid: targetFa.uid,
        faName: targetFa.name,
        messages: arrayUnion(msg),
        updatedAt: new Date().toISOString()
      });

      // แจ้งเตือน FA คนใหม่ที่ได้รับงาน
      notifyLine('ASSIGN_TASK', {
        clientName: selectedTaskModal.clientName,
        serviceType: selectedTaskModal.serviceType,
        urgency: selectedTaskModal.urgency,
        dueDate: selectedTaskModal.dueDate,
        notes: `[โอนย้ายงาน] งานนี้ถูกส่งต่อให้คุณดูแล โดย ${userProfile?.name}`
      }, targetFa.uid);

      showToast(`โอนย้ายงานให้ ${targetFa.name} สำเร็จแล้ว`);
    } catch (e) {
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนผู้รับผิดชอบ", "error");
    } finally {
      setActionLoading(p => ({ ...p, [`assignee-${taskId}`]: false }));
    }
  };

  const handleSendMessage = async (taskId) => {
    const text = chatInputs[taskId] || "";
    if (!text.trim()) return;
    setActionLoading(p => ({ ...p, [`chat-${taskId}`]: true }));
    try {
      const msg = { text: text.trim(), senderName: userProfile?.name, senderRole: userProfile?.role, timestamp: new Date().toISOString() };
      await updateDoc(doc(db, 'tasks', taskId), { messages: arrayUnion(msg), updatedAt: new Date().toISOString() });
      setChatInputs(p => ({ ...p, [taskId]: "" }));

      // ส่งแจ้งเตือนแชทงาน พร้อมแนบ taskId และ senderUid ให้หลังบ้านไปกวาดรายชื่อผู้เกี่ยวข้อง
      notifyLine('TASK_CHAT', {
        taskId: taskId,                     // เพิ่มรหัสอ้างอิงงาน
        taskName: selectedTaskModal.clientName,
        senderName: userProfile.name,
        senderUid: user.uid,                // เพิ่มรหัสของคนพิมพ์
        text: text.trim()
      }, 'ALL'); // ส่ง ALL ไปเพื่อให้หลังบ้านทำงานในโหมดกวาดรายชื่อ

    } finally { setActionLoading(p => ({ ...p, [`chat-${taskId}`]: false })); }
  };

  const handleUploadChatFile = async (taskId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast("ไฟล์มีขนาดใหญ่เกิน 5MB", "error");
    setIsUploadingChatFile(true);
    try {
      const refName = `chat_attachments/${Date.now()}_${file.name}`;
      const uploadTask = uploadBytesResumable(ref(storage, refName), file);
      const url = await new Promise((res, rej) => { uploadTask.on('state_changed', null, rej, async () => res(await getDownloadURL(uploadTask.snapshot.ref))); });
      const msg = { text: "ส่งไฟล์แนบ", attachmentUrl: url, attachmentName: file.name, attachmentType: file.type, senderName: userProfile?.name, senderRole: userProfile?.role, timestamp: new Date().toISOString() };
      await updateDoc(doc(db, 'tasks', taskId), { messages: arrayUnion(msg), updatedAt: new Date().toISOString() });
      
      // ส่งแจ้งเตือนแชทงาน (แนบไฟล์) พร้อมแนบ taskId และ senderUid ให้หลังบ้านไปกวาดรายชื่อผู้เกี่ยวข้อง
      notifyLine('TASK_CHAT', {
        taskId: taskId,                     // เพิ่มรหัสอ้างอิงงาน
        taskName: selectedTaskModal.clientName,
        senderName: userProfile.name,
        senderUid: user.uid,                // เพิ่มรหัสของคนพิมพ์
        text: "[ส่งรูปภาพ/ไฟล์แนบ]"
      }, 'ALL'); // ส่ง ALL ไปเพื่อให้หลังบ้านทำงานในโหมดกวาดรายชื่อ
      
    } catch (err) { showToast("อัปโหลดไฟล์ไม่สำเร็จ", "error"); } 
    finally { setIsUploadingChatFile(false); e.target.value = null; }
  };

  const handleSendDM = async (e) => {
    e.preventDefault();
    if (!dmInput.trim() || !activeChatUser) return;
    try {
      const chatId = getChatId(user.uid, activeChatUser.uid);
      await addDoc(collection(db, `chats/${chatId}/messages`), { text: dmInput.trim(), senderId: user.uid, senderName: userProfile?.name, timestamp: new Date().toISOString(), isRead: false });
      
      notifyLine('DM_CHAT', {
        senderName: userProfile.name,
        text: dmInput.trim()
      }, activeChatUser.uid);

      setDmInput("");
    } catch (e) { showToast("ส่งข้อความไม่สำเร็จ", "error"); }
  };

  const handleUploadDmFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChatUser) return;
    if (file.size > 5 * 1024 * 1024) return showToast("ไฟล์มีขนาดใหญ่เกิน 5MB", "error");
    setIsUploadingDmFile(true);
    try {
      const chatId = getChatId(user.uid, activeChatUser.uid);
      const refName = `chat_attachments/${Date.now()}_${file.name}`;
      const uploadTask = uploadBytesResumable(ref(storage, refName), file);
      const url = await new Promise((res, rej) => { uploadTask.on('state_changed', null, rej, async () => res(await getDownloadURL(uploadTask.snapshot.ref))); });
      
      await addDoc(collection(db, `chats/${chatId}/messages`), { 
         text: "ส่งไฟล์แนบ", attachmentUrl: url, attachmentName: file.name, attachmentType: file.type,
         senderId: user.uid, senderName: userProfile?.name, timestamp: new Date().toISOString(), isRead: false 
      });
    } catch (err) { showToast("อัปโหลดไฟล์ไม่สำเร็จ", "error"); } 
    finally { setIsUploadingDmFile(false); e.target.value = null; }
  };

  const handleAddEventSubmit = async (e) => {
    e.preventDefault();
    if (!eventForm.title || !selectedDateStr) return;
    try {
      await addDoc(collection(db, 'events'), { 
        title: eventForm.title, 
        date: selectedDateStr, 
        type: eventForm.type, 
        color: eventForm.color,
        startTime: eventForm.startTime || "", 
        endTime: eventForm.endTime || "",     
        createdBy: user.uid, 
        createdAt: new Date().toISOString() 
      });

      if (eventForm.type === 'company') {
        notifyLine('COMPANY_EVENT', {
          title: eventForm.title,
          date: selectedDateStr,
          startTime: eventForm.startTime,
          endTime: eventForm.endTime
        }, 'ALL');
      }

      setShowEventModal(false); 
      setEventForm({ title: "", type: "personal", color: "blue", startTime: "", endTime: "" }); 
      showToast("เพิ่มกิจกรรมเรียบร้อย");
    } catch (error) { showToast("เกิดข้อผิดพลาด", "error"); }
  };

  const handleDeleteTask = async (taskId) => {
    setActionLoading(prev => ({ ...prev, [`delete-${taskId}`]: true }));
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      showToast("ลบงานติดตามนี้ถาวรเรียบร้อยแล้ว");
      setSelectedTaskModal(null);
      setDeleteConfirmId(null);
    } catch (error) { showToast("เกิดข้อผิดพลาด ไม่สามารถลบงานได้", "error"); }
    finally { setActionLoading(prev => ({ ...prev, [`delete-${taskId}`]: false })); }
  };

  const allAvailableFAs = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => map.set(t.faUid, { uid: t.faUid, name: t.faName, role: 'FA' }));
    dbUsers.forEach(u => { if(u.role === 'FA' || u.role === 'Admin' || u.role === 'Executive' || !u.role) map.set(u.uid, u); });
    return Array.from(map.values());
  }, [tasks, dbUsers]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    
    if (activeTab === 'front') {
      list = list.filter(t => t.faUid === user?.uid && t.formMode === frontListMode);
    } else {
      list = list.filter(t => t.formMode !== 'private' || t.faUid === user?.uid);
    }

    return list.filter(t => {
      const matchSearch = (t.clientName||'').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.policyNumber||'').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.faName||'').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.trackingId||'').toLowerCase().includes(searchQuery.toLowerCase());
      const matchFa = selectedFaFilter === "all" || t.faUid === selectedFaFilter;
      const d = new Date(t.createdAt);
      const matchMonth = selectedMonth === "all" || (d.getMonth() + 1).toString().padStart(2, '0') === selectedMonth;
      const matchYear = selectedYear === "all" || d.getFullYear().toString() === selectedYear;
      return matchSearch && matchFa && matchMonth && matchYear;
    });
  }, [tasks, activeTab, user, frontListMode, searchQuery, selectedFaFilter, selectedMonth, selectedYear]);

  const getStatusStyle = (status) => {
    switch(status) {
      case 'Approved': return 'text-[#059669] bg-green-50'; 
      case 'In Progress': return 'text-[#0284c7] bg-sky-50'; 
      case 'Rejected': return 'text-[#dc2626] bg-red-50'; 
      default: return 'text-[#ca8a04] bg-yellow-50'; 
    }
  };

  const formatBadgeText = (type, diffDays) => {
    if (language === 'JP' || language === 'EN') {
      if (type === 'overdue') return `${t('overdue')} ${diffDays} ${t('days')}`;
      return `${t('daysLeft')} ${diffDays} ${t('days')}`;
    }
    if (type === 'overdue') return `${t('overdue')} ${diffDays} ${t('days')}`;
    return `${t('daysLeft')} ${diffDays} ${t('days')}`;
  };

  const renderCountdownBadge = (dueDateStr, status) => {
    if (!dueDateStr || status === 'Approved') return null;
    const diffDays = Math.ceil((new Date(dueDateStr) - new Date()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium border border-red-100 mt-1">{formatBadgeText('overdue', Math.abs(diffDays))}</span>;
    if (diffDays <= 1) return <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-medium shadow-sm animate-pulse mt-1">🔴 {t('urgent')} ({formatBadgeText('left', diffDays)})</span>;
    if (diffDays <= 3) return <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium border border-orange-100 mt-1">{formatBadgeText('left', diffDays)}</span>;
    return <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full font-medium border border-gray-200 mt-1">{formatBadgeText('left', diffDays)}</span>;
  };

  const renderToast = () => {
    if (!toastMessage) return null;
    return (
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[3000] animate-[fadeIn_0.3s_ease-out]">
        <div className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.08)] font-light text-sm bg-white/95 backdrop-blur-md border border-gray-100 ${toastMessage.type === 'error' ? 'text-red-600' : 'text-gray-800'}`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0 text-[#DEFF00]" />}
          {toastMessage.message}
        </div>
      </div>
    );
  };

  const renderDateFilters = () => (
    <div className="flex gap-2">
      <div className="relative">
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="bg-white border border-gray-100 w-full px-5 py-2.5 pl-10 text-[11px] font-light rounded-full cursor-pointer appearance-none text-gray-700 outline-none hover:bg-gray-50 transition-colors">
          <option value="all">{t('everyMonth')}</option>
          {MONTHS.map(m => <option key={m.val} value={m.val}>{t(`month${m.val}`)}</option>)}
        </select>
        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      </div>
      <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} className="bg-white border border-gray-100 px-5 py-2.5 text-[11px] font-light rounded-full cursor-pointer appearance-none text-gray-700 outline-none hover:bg-gray-50 transition-colors">
        <option value="all">{t('everyYear')}</option>
        {YEARS.filter(y=>y!=='all').map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );

  const renderTaskTable = (tasksList) => (
    <div className="bg-white rounded-[2rem] p-4 sm:p-6 shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-gray-50 mt-6 overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="text-[10px] text-gray-400 font-medium uppercase tracking-widest border-b border-gray-50">
              <th className="py-4 px-4 font-medium">{t('colClient')}</th>
              <th className="py-4 px-4 font-medium text-center">{t('colType')}</th>
              <th className="py-4 px-4 font-medium text-center">{t('colDue')}</th>
              <th className="py-4 px-4 font-medium text-center">{t('colFa')}</th>
              <th className="py-4 px-4 font-medium text-center">{t('colManage')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50/50">
            {tasksList.map(task => {
              const hasUnread = task.messages?.length > 0 && task.messages[task.messages.length - 1].senderName !== userProfile?.name;
              return (
                <tr key={task.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="py-4 px-4 cursor-pointer" onClick={() => setSelectedTaskModal(task)}>
                    <span className="text-[10px] text-gray-400 font-light block tracking-widest mb-0.5 uppercase">#{task.trackingId || task.id.slice(-6).toUpperCase()}</span>
                    <p className="font-light text-gray-800 flex items-center gap-1.5 text-sm">
                      {task.clientName}
                      {task.urgency === 'ด่วน' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm" title={t('urgent')}></span>}
                    </p>
                  </td>
                  <td className="py-4 px-4 text-center text-gray-500 font-light text-xs">{t(task.serviceType)}</td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-gray-600 text-xs font-light">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('th-TH') : '-'}</span>
                      {renderCountdownBadge(task.dueDate, task.status)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center text-gray-600 font-light text-xs">{task.faName}</td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className={`inline-block text-[11px] px-3 py-1 rounded-full font-medium ${getStatusStyle(task.status)}`}>
                        {t(KANBAN_COLUMNS.find(c=>c.id===task.status)?.tKey) || task.status}
                      </span>
                      <button onClick={() => setSelectedTaskModal(task)} className="relative text-gray-500 hover:text-gray-800 text-[10px] font-light border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors">
                        {t('viewData')}
                        {hasUnread && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse"></span>}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {tasksList.length === 0 && <tr><td colSpan="5" className="text-center py-12 text-gray-400 font-light text-sm">{t('empty')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCalendarView = () => {
    const displayMonthNum = selectedMonth === 'all' ? new Date().getMonth() + 1 : parseInt(selectedMonth);
    const displayYearNum = selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear);
    
    const daysInMonth = new Date(displayYearNum, displayMonthNum, 0).getDate();
    const firstDay = new Date(displayYearNum, displayMonthNum - 1, 1).getDay();
    const today = new Date();
    
    const displayYearText = language === 'TH' ? displayYearNum + 543 : displayYearNum;
    const monthName = t(`month${displayMonthNum.toString().padStart(2, '0')}`);
    
    let calendarTasks = tasks;
    if (activeTab === 'front') {
      calendarTasks = calendarTasks.filter(t => t.faUid === user?.uid && t.formMode === frontListMode);
    } else {
      calendarTasks = calendarTasks.filter(t => t.formMode !== 'private' || t.faUid === user?.uid);
      if (selectedFaFilter !== "all") {
        calendarTasks = calendarTasks.filter(t => t.faUid === selectedFaFilter);
      }
    }
    if (searchQuery) {
      calendarTasks = calendarTasks.filter(t => 
        (t.clientName||'').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.faName||'').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.trackingId||'').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const days = [];
    for(let i=0; i<firstDay; i++) days.push(null);
    for(let i=1; i<=daysInMonth; i++) days.push(i);

    const handleDayClick = (day) => {
      if(!day) return;
      const dateStr = `${displayYearNum}-${displayMonthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      setSelectedDateStr(dateStr); setShowEventModal(true);
    };

    return (
      <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-gray-50 mt-6 animate-[fadeIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-medium text-gray-800 flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-gray-400 stroke-[1.5]"/> {t('calendar')}</h2>
          <div className="flex items-center gap-6">
             <div className="bg-gray-50 p-1 rounded-full flex text-[11px] font-medium border border-gray-100">
                <button onClick={()=>setCalendarFilter('personal')} className={`px-5 py-2 rounded-full transition-all ${calendarFilter === 'personal' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('personal')}</button>
                <button onClick={()=>setCalendarFilter('company')} className={`px-5 py-2 rounded-full transition-all ${calendarFilter === 'company' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('company')}</button>
             </div>
             <div className="flex items-center gap-4 text-sm font-medium text-gray-700">
               {monthName} {displayYearText}
             </div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-3xl overflow-hidden">
          {[t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')].map((d, index) => <div key={index} className="bg-white text-center text-[10px] font-light text-gray-400 uppercase tracking-widest py-4">{d}</div>)}
          {days.map((d, i) => {
            const isToday = d === today.getDate() && displayMonthNum === today.getMonth() + 1 && displayYearNum === today.getFullYear();
            const dateStr = d ? `${displayYearNum}-${displayMonthNum.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}` : '';
            const dayEvents = events.filter(ev => ev.date === dateStr && (calendarFilter === 'company' ? ev.type === 'company' : ev.type === 'personal' && ev.createdBy === user.uid));
            const dayTasks = d ? calendarTasks.filter(t => t.dueDate === dateStr) : [];

            return (
              <div key={i} onClick={() => handleDayClick(d)} className="bg-white min-h-[120px] p-2 hover:bg-gray-50/50 transition-colors cursor-pointer relative group">
                 {d && <span className={`text-[11px] font-light flex items-center justify-center w-7 h-7 rounded-full mb-1 ${isToday ? 'bg-[#DEFF00] text-[#161A22] font-medium shadow-sm' : 'text-gray-500'}`}>{d}</span>}
                 {d && <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="w-3 h-3 text-gray-300"/></div>}
                 <div className="space-y-1">
                   {dayTasks.map(task => (
                       <div key={`task-${task.id}`} onClick={(e) => { e.stopPropagation(); setSelectedTaskModal(task); }} className={`text-[9px] px-2 py-1.5 rounded-md truncate font-medium flex items-center gap-1.5 shadow-sm border cursor-pointer hover:scale-[1.02] transition-transform ${
                           task.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' :
                           task.status === 'In Progress' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                           task.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                           'bg-yellow-50 text-yellow-700 border-yellow-100'
                       }`} title={`${task.clientName} (${t(task.serviceType)})`}>
                           <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                               task.status === 'Approved' ? 'bg-green-500' :
                               task.status === 'In Progress' ? 'bg-sky-500' :
                               task.status === 'Rejected' ? 'bg-red-500' :
                               'bg-yellow-500'
                           }`}></span>
                           <span className="truncate">{task.clientName}</span>
                           {task.urgency === 'ด่วน' && <span className="ml-auto text-[8px] shrink-0">🔥</span>}
                       </div>
                   ))}
                   {dayEvents.map(ev => (
                       <div key={`ev-${ev.id}`} className={`text-[9px] px-2 py-1 rounded-md truncate font-light flex flex-col ${ev.color === 'blue' ? 'bg-blue-50 text-blue-600' : ev.color === 'yellow' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                          <span className="font-medium truncate">{ev.title}</span>
                          {(ev.startTime || ev.endTime) && <span className="text-[8px] opacity-80 mt-0.5">{ev.startTime || '...'} - {ev.endTime || '...'}</span>}
                       </div>
                   ))}
                 </div>
              </div>
            )
          })}
        </div>
        
        {showEventModal && (
          <div className="fixed inset-0 z-[2010] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm" onClick={()=>setShowEventModal(false)}></div>
             <div className="relative bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm animate-[fadeIn_0.2s_ease-out]">
               <h3 className="text-sm font-medium mb-4 text-gray-800 flex justify-between items-center">
                 <span>{t('addEventTitle')}: {selectedDateStr}</span>
                 <button onClick={() => setShowEventModal(false)}><X className="w-4 h-4 text-gray-400"/></button>
               </h3>
               <form onSubmit={handleAddEventSubmit} className="space-y-4">
                 <input type="text" required placeholder={t('eventNameInput')} value={eventForm.title} onChange={e=>setEventForm({...eventForm, title:e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-light outline-none focus:border-[#DEFF00]" />
                 
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-[10px] text-gray-500 mb-1 block">{t('startTime')}</label>
                     <input type="time" value={eventForm.startTime} onChange={e=>setEventForm({...eventForm, startTime:e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-light outline-none focus:border-[#DEFF00]" />
                   </div>
                   <div>
                     <label className="text-[10px] text-gray-500 mb-1 block">{t('endTime')}</label>
                     <input type="time" value={eventForm.endTime} onChange={e=>setEventForm({...eventForm, endTime:e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-light outline-none focus:border-[#DEFF00]" />
                   </div>
                 </div>

                 <select value={eventForm.type} onChange={e=>setEventForm({...eventForm, type:e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-light outline-none">
                   <option value="personal">{t('personalEvent')}</option>
                   <option value="company">{t('companyEvent')}</option>
                 </select>
                 <div className="flex gap-2">
                   {['blue', 'yellow', 'red'].map(c => <button type="button" key={c} onClick={()=>setEventForm({...eventForm, color:c})} className={`w-8 h-8 rounded-full border-2 ${eventForm.color === c ? 'border-gray-800' : 'border-transparent'} ${c==='blue'?'bg-blue-400':c==='yellow'?'bg-yellow-400':'bg-red-400'}`}></button>)}
                 </div>
                 <button type="submit" className="w-full bg-[#161A22] text-[#DEFF00] py-3 rounded-xl text-xs font-medium hover:bg-black transition-colors">{t('saveEventBtn')}</button>
               </form>
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderDMWidget = () => {
    const totalUnread = Object.values(unreadCounts).filter(Boolean).length;
    if (!isDmOpen) {
      return (
        <button onClick={()=>setIsDmOpen(true)} className="fixed bottom-6 right-6 z-[990] w-14 h-14 rounded-full bg-[#161A22] text-[#DEFF00] flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.15)] hover:scale-105 transition-transform">
          <MessageCircle className="w-6 h-6 stroke-[1.5]"/>
          {totalUnread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-pulse">{totalUnread}</span>}
        </button>
      );
    }
    return (
      <div className="fixed bottom-6 right-6 z-[990] w-[340px] h-[500px] max-h-[80vh] bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {dmView === 'list' ? (
          <>
            <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-[#161A22] text-white">
              <h3 className="font-light text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4 text-[#DEFF00] stroke-[1.5]"/> {t('chatTitle')}</h3>
              <button onClick={() => setIsDmOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-gray-50/30">
              <div className="px-4 py-3 text-[9px] font-medium text-gray-400 uppercase tracking-widest">{t('staffList')}</div>
              {dbUsers.map(u => (
                <button key={u.uid} onClick={()=>{setActiveChatUser(u); setDmView('chat');}} className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-2xl transition-colors border border-transparent hover:border-gray-100 hover:shadow-sm relative">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-light border border-gray-200">
                    {u.name?.charAt(0)}
                    {unreadCounts[u.uid] && <span className="absolute top-2 left-10 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                  </div>
                  <div className="text-left"><p className="text-xs font-medium text-gray-800">{u.name}</p><p className="text-[10px] text-gray-400 font-light mt-0.5">{u.role || 'FA'}</p></div>
                </button>
              ))}
              {dbUsers.length === 0 && <div className="text-center py-8 text-xs text-gray-400">{t('noStaff')}</div>}
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-gray-50 flex items-center gap-3 bg-[#161A22] text-white">
              <button onClick={() => setDmView('list')} className="text-gray-400 hover:text-[#DEFF00] transition-colors"><ChevronLeft className="w-5 h-5 stroke-[1.5]"/></button>
              <div className="flex-1"><h3 className="font-light text-sm">{activeChatUser?.name}</h3><p className="text-[9px] text-gray-400 tracking-widest uppercase">{activeChatUser?.role}</p></div>
              <button onClick={() => setIsDmOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 custom-scrollbar">
              {dmMessages.length === 0 ? <div className="h-full flex items-center justify-center text-gray-400 text-xs font-light">{t('startChat')}</div> : 
                dmMessages.map((msg, idx) => {
                  const isMe = msg.senderId === user.uid;
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-[13px] font-light max-w-[85%] ${isMe ? 'bg-[#DEFF00] text-[#161A22] rounded-tr-sm shadow-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-sm'}`}>
                        {msg.text}
                        {msg.attachmentUrl && (
                          <div className="mt-2 block pb-1">
                            {(msg.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || msg.attachmentType?.startsWith('image/')) ? 
                              <div className="cursor-pointer inline-block" onClick={() => setFullscreenImage(msg.attachmentUrl)}>
                                <img src={msg.attachmentUrl} alt="attachment" className="max-h-[150px] w-auto object-contain rounded-lg shadow-sm border border-black/5 hover:opacity-90 transition-opacity" />
                              </div> :
                              <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1.5 mt-1 bg-white/50 px-3 py-2 rounded-lg border border-white/40"><Paperclip className="w-3.5 h-3.5"/> {msg.attachmentName || t('downloadAttach')}</a>
                            }
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-400 mt-1 mx-1 font-light">{new Date(msg.timestamp).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  );
                })
              }
              <div ref={dmChatEndRef} />
            </div>
            <form onSubmit={handleSendDM} className="p-2.5 bg-white border-t border-gray-100 flex gap-2 items-center">
              <label className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full cursor-pointer transition-colors shrink-0" title={t('attachFileText')}>
                 {isUploadingDmFile ? <Loader2 className="w-4 h-4 animate-spin"/> : <ImageIcon className="w-4 h-4 stroke-[1.5]" />}
                 <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUploadDmFile} disabled={isUploadingDmFile} />
              </label>
              <input type="text" value={dmInput} onChange={e=>setDmInput(e.target.value)} placeholder={t('typeMessage')} className="flex-1 bg-gray-50 px-4 py-2 text-sm font-light rounded-full outline-none text-gray-800 focus:bg-white border border-gray-100 focus:border-gray-200" />
              <button type="submit" disabled={!dmInput.trim()} className="w-9 h-9 bg-[#161A22] text-[#DEFF00] rounded-full flex items-center justify-center shrink-0 hover:bg-black transition-colors disabled:opacity-50"><Send className="w-3.5 h-3.5 ml-0.5 stroke-[1.5]"/></button>
            </form>
          </>
        )}
      </div>
    );
  };

  const generateInfoPDF = async (element) => {
    try {
      const canvas = await window.html2canvas(element, {
        scale: 2, 
        useCORS: true,
        windowWidth: 800, 
        width: 800
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4'); 
      
      const pdfWidth = 210; 
      const pdfHeight = 297; 
      const margin = 10; 

      const printWidth = pdfWidth - (margin * 2);
      const printHeight = pdfHeight - (margin * 2);

      const imgHeightInMm = (canvas.height * printWidth) / canvas.width;

      let heightLeft = imgHeightInMm;
      let yPosition = margin;

      pdf.addImage(imgData, 'JPEG', margin, yPosition, printWidth, imgHeightInMm);
      heightLeft -= printHeight;

      while (heightLeft > 0) {
        yPosition -= printHeight; 
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, yPosition, printWidth, imgHeightInMm);
        heightLeft -= printHeight;
      }

      pdf.save(`MCDJ_TaskInfo_${pdfTask?.trackingId || 'Report'}.pdf`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      showToast("เกิดข้อผิดพลาดในการสร้าง PDF ข้อมูล", "error");
    } finally {
      setIsDownloadingInfo(false);
      setHideImagesForPdf(false); 
    }
  };

  const handleDownloadInfoPDF = () => {
    setHideImagesForPdf(true); 
    setIsDownloadingInfo(true);

    setTimeout(() => {
      const element = document.getElementById('pdf-content');
      if (!element) {
        setIsDownloadingInfo(false);
        setHideImagesForPdf(false);
        return;
      }

      if (window.html2canvas && window.jspdf) {
        generateInfoPDF(element);
      } else {
        const script1 = document.createElement('script');
        script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.body.appendChild(script1);

        script1.onload = () => {
          const script2 = document.createElement('script');
          script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          document.body.appendChild(script2);
          
          script2.onload = () => generateInfoPDF(element);
        };
      }
    }, 500);
  };

  const handleDownloadAllFiles = async () => {
    setIsDownloadingImages(true); 
    try {
      const filesToDownload = [];
      
      if (pdfTask.attachments) {
        pdfTask.attachments.forEach(f => {
          filesToDownload.push({ url: f.url, name: f.name || `attachment_${Date.now()}` });
        });
      }
      
      if (pdfTask.messages) {
        pdfTask.messages.forEach(m => {
          if (m.attachmentUrl) {
            filesToDownload.push({ url: m.attachmentUrl, name: m.attachmentName || `chat_file_${Date.now()}` });
          }
        });
      }

      if (filesToDownload.length === 0) {
        showToast("ไม่พบไฟล์แนบในงานนี้", "error");
        setIsDownloadingImages(false);
        return;
      }

      showToast(`กำลังเตรียมดาวน์โหลดไฟล์ทั้งหมด ${filesToDownload.length} ไฟล์...`);

      for (let i = 0; i < filesToDownload.length; i++) {
        const file = filesToDownload[i];
        try {
          const response = await fetch(file.url);
          if (!response.ok) throw new Error("Network response was not ok");
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.warn("Fetch failed, fallback to open window:", file.url, err);
          window.open(file.url, '_blank');
        }
      }
      
      showToast("ดาวน์โหลดไฟล์แนบสำเร็จ");
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์แนบ", "error");
    } finally {
      setIsDownloadingImages(false);
    }
  };

  const allDownloadableFiles = useMemo(() => {
    if (!pdfTask) return [];
    const files = [];
    if (pdfTask.attachments) {
      pdfTask.attachments.forEach((f, idx) => {
        files.push({ url: f.url, name: f.name || `ไฟล์แนบ_${idx + 1}`, type: 'task' });
      });
    }
    if (pdfTask.messages) {
      pdfTask.messages.forEach((m, idx) => {
        if (m.attachmentUrl) {
          files.push({ url: m.attachmentUrl, name: m.attachmentName || `ไฟล์แชท_${idx + 1}`, type: 'chat' });
        }
      });
    }
    return files;
  }, [pdfTask]);

  const renderPdfView = () => {
    if (!pdfTask) return null;
    const task = pdfTask;
    return (
      <div className="min-h-screen bg-[#F5F7F0] font-['Kanit',sans-serif]">
        <div className="no-print bg-[#161A22] w-full p-3 sm:p-4 flex justify-between items-center sticky top-0 z-[999] shadow-md font-sans">
           <button onClick={() => { setPdfTask(null); setActiveTab('front'); }} className="text-gray-300 hover:text-white flex items-center gap-2 text-xs sm:text-sm font-light transition-colors"><ChevronLeft className="w-4 h-4"/> <span className="hidden sm:inline">{t('back')}</span></button>
           <span className="text-gray-300 text-[10px] sm:text-xs font-light hidden sm:flex items-center gap-2"><FileText className="w-4 h-4 text-gray-500"/> {t('pdfReport')}</span>
           <div className="flex gap-2 sm:gap-3">
             <button onClick={handleDownloadInfoPDF} disabled={isDownloadingInfo || isDownloadingImages} className="bg-white text-[#161A22] border border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50">
                {isDownloadingInfo ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
                <span className="hidden sm:inline">โหลดรายงาน (ตัวหนังสือ)</span>
                <span className="sm:hidden">รายงาน</span>
             </button>
             <button onClick={() => setShowFilesModal(true)} disabled={isDownloadingInfo || isDownloadingImages} className="bg-[#DEFF00] text-[#161A22] px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 shadow-sm hover:shadow-md transition-all disabled:opacity-50">
                <Download className="w-4 h-4"/>
                <span className="hidden sm:inline">โหลดไฟล์แนบทั้งหมด</span>
                <span className="sm:hidden">โหลดไฟล์</span>
             </button>
           </div>
        </div>

        {showFilesModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowFilesModal(false)}></div>
             <div className="relative bg-white p-6 rounded-3xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
                   <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2"><Paperclip className="w-5 h-5 text-gray-400"/> ไฟล์แนบทั้งหมด</h3>
                   <button onClick={() => setShowFilesModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full transition-colors"><X className="w-5 h-5"/></button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                   {allDownloadableFiles.length === 0 ? (
                     <div className="text-center py-8 text-sm text-gray-400">ไม่มีไฟล์แนบในงานนี้</div>
                   ) : (
                     allDownloadableFiles.map((file, idx) => {
                       const isImg = file.url.match(/\.(jpeg|jpg|gif|png|webp)/i) || file.url.includes('images%2F') || file.url.includes('image');
                       return (
                         <div key={idx} className="flex items-center justify-between p-3 bg-gray-50/50 hover:bg-white border border-gray-100 hover:border-[#DEFF00] hover:shadow-sm transition-all rounded-2xl">
                            <div className="flex items-center gap-3 overflow-hidden pr-3">
                               <div className="w-10 h-10 shrink-0 bg-white rounded-xl border border-gray-100 flex items-center justify-center shadow-sm">
                                  {isImg ? <ImageIcon className="w-4 h-4 text-blue-400"/> : <FileText className="w-4 h-4 text-gray-400"/>}
                               </div>
                               <div className="flex flex-col truncate">
                                  <span className="text-sm font-medium text-gray-700 truncate">{file.name}</span>
                                  <span className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{file.type === 'task' ? 'ไฟล์แนบ (คำขอ)' : 'ส่งในช่องแชท'}</span>
                               </div>
                            </div>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" title="ดาวน์โหลด/เปิดไฟล์" className="shrink-0 w-9 h-9 flex items-center justify-center bg-[#161A22] text-[#DEFF00] rounded-full hover:bg-black transition-colors shadow-sm">
                               <Download className="w-4 h-4"/>
                            </a>
                         </div>
                       )
                     })
                   )}
                </div>
             </div>
          </div>
        )}

        <div id="pdf-content" className="bg-white mx-auto relative text-gray-800 font-sans sm:my-8" style={{ width: '800px', padding: '40px', boxSizing: 'border-box' }}>
           
           <div className="border-b-2 border-[#161A22] pb-5 mb-8 flex justify-between items-end break-inside-avoid w-full">
              <div>
                <h1 className="text-[28px] font-semibold text-[#161A22] tracking-tight mb-1">MCDJ Wealth Advisor</h1>
                <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-2.5 py-1 rounded-md font-medium tracking-widest uppercase">{t('pdfReport')}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block mb-0.5 font-medium tracking-widest uppercase">{t('refCode')}</span>
                <span className="text-xl font-bold text-[#161A22]">#{task.trackingId || task.id.slice(-6).toUpperCase()}</span>
              </div>
           </div>

           <div className="mb-8 w-full break-inside-avoid">
              <h2 className="text-sm font-semibold text-[#161A22] mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#DEFF00] text-[#161A22] flex items-center justify-center text-xs shadow-sm">1</span> 
                  {t('taskInfo')}
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-[1rem] p-4 w-full">
                  <div className="w-full bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm mb-3">
                      <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('clientName')}</p>
                      <p className="text-[15px] font-semibold text-gray-800 break-words leading-relaxed">{task.clientName}</p>
                  </div>
                  {task.policyNumber && (
                    <div className="w-full bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm mb-3">
                        <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('policyNumber')}</p>
                        <p className="text-[15px] font-semibold text-gray-800 break-words leading-relaxed">{task.policyNumber}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 w-full">
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('currentStatus')}</p>
                          <p className="text-sm font-semibold text-blue-600 leading-relaxed">{t(KANBAN_COLUMNS.find(c=>c.id===task.status)?.tKey) || task.status}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('serviceType')}</p>
                          <p className="text-sm font-medium text-gray-800 break-words leading-relaxed">{t(task.serviceType)}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('colFa')}</p>
                          <p className="text-sm font-medium text-gray-800 break-words leading-relaxed">{task.faName}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('dueDate')}</p>
                          <p className="text-sm font-semibold text-orange-600 leading-relaxed">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('th-TH') : '-'}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('urgency')}</p>
                          <p className="text-sm font-medium text-gray-800 leading-relaxed">{t(task.urgency === 'ด่วน' ? 'urgent' : 'normal')}</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">{t('createDate')}</p>
                          <p className="text-sm font-medium text-gray-800 leading-relaxed">{new Date(task.createdAt).toLocaleString('th-TH')}</p>
                      </div>
                  </div>
              </div>
           </div>

           {task.attachments && task.attachments.length > 0 && (
             <div className="mb-8 w-full break-inside-avoid">
                 <h2 className="text-sm font-semibold text-[#161A22] mb-3 flex items-center gap-2">
                     <span className="w-6 h-6 rounded-md bg-[#DEFF00] text-[#161A22] flex items-center justify-center text-xs shadow-sm">2</span> 
                     {t('attachFiles')}
                 </h2>
                 {hideImagesForPdf ? (
                   <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center text-[11px] text-gray-500 font-medium">
                     [ มีไฟล์แนบจำนวน {task.attachments.length} ไฟล์ - สามารถกดปุ่มโหลดไฟล์แนบแยกต่างหากได้ ]
                   </div>
                 ) : (
                   <div className="flex flex-wrap gap-4 w-full">
                       {task.attachments.map((file, idx) => {
                           const isImg = file.url.match(/\.(jpeg|jpg|gif|png|webp)/i) || file.url.includes('images%2F') || file.type?.startsWith('image/');
                           return (
                               <div key={idx} className="w-[calc(50%-0.5rem)] border border-gray-200 rounded-2xl p-3 flex flex-col items-center bg-gray-50 overflow-hidden max-w-full">
                                   {isImg ? <img src={file.url} alt="attachment" className="max-h-48 max-w-full object-contain mb-3 rounded-xl border border-gray-200" /> : <div className="h-24 flex items-center justify-center text-gray-400"><FileText className="w-8 h-8"/></div>}
                                   <span className="text-[10px] text-gray-500 text-center truncate w-full font-medium bg-white px-2 py-1 rounded-md border border-gray-100 block">{file.name}</span>
                               </div>
                           );
                       })}
                   </div>
                 )}
             </div>
           )}

           <div className="w-full">
              <h2 className="text-sm font-semibold text-[#161A22] mb-4 flex items-center gap-2 break-inside-avoid">
                  <span className="w-6 h-6 rounded-md bg-[#DEFF00] text-[#161A22] flex items-center justify-center text-xs shadow-sm">{task.attachments && task.attachments.length > 0 ? '3' : '2'}</span> 
                  {t('chatHistory')}
              </h2>
              <div className="space-y-4 w-full">
                  {(!task.messages || task.messages.length===0) ? <div className="bg-gray-50 rounded-xl p-4 text-center text-xs text-gray-400 font-medium break-inside-avoid">{t('noChatHistory')}</div> : 
                      task.messages.map((m, i) => {
                         return (
                          <div key={i} className="break-inside-avoid bg-white border border-gray-100 shadow-sm p-4 rounded-2xl flex flex-col w-full max-w-full">
                              <div className="flex justify-between items-start mb-2 w-full">
                                  <span className="text-[11px] font-semibold text-gray-800">{m.senderName} <span className="text-[9px] text-gray-400 font-medium ml-1 px-1.5 py-0.5 bg-gray-100 rounded-md uppercase">{m.senderRole}</span></span>
                                  <span className="text-[10px] text-gray-400 font-medium">{new Date(m.timestamp).toLocaleString('th-TH')}</span>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl w-full break-words whitespace-pre-wrap">{m.text}</p>
                              {m.attachmentUrl && (
                                  <div className="mt-3 w-full">
                                      {hideImagesForPdf ? (
                                        <div className="text-[10px] text-gray-500 font-medium bg-gray-100 px-3 py-1.5 rounded-lg w-fit border border-gray-200">
                                          [ มีรูปภาพ/ไฟล์แนบในแชท - สามารถกดปุ่มโหลดไฟล์แนบแยกต่างหากได้ ]
                                        </div>
                                      ) : (
                                        (m.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || m.attachmentType?.startsWith('image/')) ? 
                                            <img src={m.attachmentUrl} alt="chat-attachment" className="max-h-48 max-w-full rounded-xl border border-gray-200 shadow-sm object-contain" /> :
                                            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded-lg inline-flex items-center gap-1.5 border border-blue-100 w-fit"><Paperclip className="w-3.5 h-3.5"/> {m.attachmentName || t('downloadAttach')}</a>
                                      )}
                                  </div>
                              )}
                          </div>
                        )
                      })
                  }
              </div>
           </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center font-['Kanit',sans-serif]"><Loader2 className="w-8 h-8 animate-spin text-gray-300"/></div>;

  if (!user) return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col justify-center items-center font-['Kanit',sans-serif] selection:bg-[#DEFF00] selection:text-black relative">
       {renderToast()}
       <div className="fixed inset-0 bg-gradient-to-br from-[#FDFDFD] via-[#FDFDFD] to-[#F5F7F0] -z-10"></div>
       <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#DEFF00] rounded-full mix-blend-multiply blur-[150px] opacity-[0.12] pointer-events-none"></div>

       <style dangerouslySetInnerHTML={{__html: `
         @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@100;200;300;400;500;600&display=swap');
         * { font-family: 'Kanit', sans-serif !important; }
         .glass-card { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.4); border-top: 1px solid rgba(255, 255, 255, 0.9); border-left: 1px solid rgba(255, 255, 255, 0.9); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.03); border-radius: 2.5rem; }
         .input-glass { background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.6); border-top: 1px solid rgba(255, 255, 255, 0.9); border-left: 1px solid rgba(255, 255, 255, 0.9); box-shadow: inset 0 2px 5px rgba(0,0,0,0.02), 0 2px 10px rgba(0,0,0,0.02); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
         .input-glass:focus { background: rgba(255, 255, 255, 0.95); border-color: #DEFF00; outline: none; box-shadow: 0 0 0 4px rgba(222, 255, 0, 0.3), 0 4px 12px rgba(0,0,0,0.05); transform: translateY(-1px); }
       `}} />

       <div className="mb-10 text-center relative z-10 flex flex-col items-center">
         <div className="flex gap-1 items-baseline"><span className="text-[40px] font-medium tracking-tight text-[#161A22]">MCDJ</span></div>
         <span className="text-[10px] font-light tracking-[0.3em] text-gray-500 uppercase mt-2">WEALTH ADVISOR</span>
       </div>

       <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-gray-50 w-full max-w-[400px] relative z-10">
         <h3 className="text-lg font-medium text-gray-800 mb-8 text-center">{t('login')}</h3>
         <form onSubmit={handleLogin} className="space-y-5">
           <div>
             <label className="block text-[11px] font-medium text-gray-400 mb-2">{t('email')}</label>
             <div className="relative">
               <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@mcdj.com" className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-light outline-none focus:border-[#DEFF00] focus:bg-white transition-colors" />
             </div>
           </div>
           <div>
             <label className="block text-[11px] font-medium text-gray-400 mb-2">{t('pass')}</label>
             <div className="relative">
               <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-light outline-none focus:border-[#DEFF00] focus:bg-white transition-colors" />
             </div>
           </div>
           <button type="submit" disabled={signingIn} className="w-full bg-[#DEFF00] text-[#161A22] font-medium text-sm py-3.5 rounded-full hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-6">
             {signingIn ? <Loader2 className="w-4 h-4 animate-spin"/> : t('login')}
           </button>
         </form>
       </div>
    </div>
  );

  if (activeTab === "pdf") return renderPdfView();

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-gray-800 font-['Kanit',sans-serif] pb-24 selection:bg-[#DEFF00] selection:text-black relative z-0">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@100;200;300;400;500;600&display=swap');
        * { font-family: 'Kanit', sans-serif !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        @media print { body { background: white !important; } .no-print { display: none !important; } #pdf-content { box-shadow: none !important; padding: 0 !important; width: 100% !important; margin: 0 !important; border:none !important; } }
      `}} />

      <div className="fixed inset-0 bg-gradient-to-br from-[#FDFDFD] via-[#FDFDFD] to-[#F7F9F2] -z-10"></div>
      
      {renderToast()}
      {renderDMWidget()}

      {selectedTaskModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 sm:p-6 bg-white sm:bg-[#161A22]/20 sm:backdrop-blur-sm">
          <div className="relative w-full h-full sm:h-[90vh] sm:max-h-[90vh] max-w-5xl bg-white sm:rounded-[2.5rem] sm:shadow-[0_10px_50px_rgba(0,0,0,0.1)] flex flex-col animate-[fadeIn_0.2s_ease-out] overflow-hidden">
            
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 sm:bg-white z-10 sticky top-0 shrink-0">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-light text-gray-500 tracking-widest bg-white sm:bg-white/60 px-2.5 py-1 rounded-full border border-gray-200">#{selectedTaskModal.trackingId || selectedTaskModal.id.slice(-6).toUpperCase()}</span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${getStatusStyle(selectedTaskModal.status)}`}>{t(KANBAN_COLUMNS.find(c=>c.id===selectedTaskModal.status)?.tKey) || selectedTaskModal.status}</span>
                  {selectedTaskModal.urgency === 'ด่วน' && <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-100 text-red-600">{t('urgent')}</span>}
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-gray-800">{selectedTaskModal.clientName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setPdfTask(selectedTaskModal); setActiveTab('pdf'); setSelectedTaskModal(null); }} className="bg-[#161A22] text-[#DEFF00] px-3 py-2 rounded-full text-xs font-medium shadow-sm flex items-center gap-1.5 hover:bg-black transition-colors">
                  <FileText className="w-3.5 h-3.5"/> <span className="hidden sm:inline">{t('savePdf')}</span>
                </button>
                <button onClick={()=>setSelectedTaskModal(null)} className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-full hover:bg-gray-100 transition-colors shrink-0 text-gray-500"><X className="w-4 h-4 stroke-[1.5]"/></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 custom-scrollbar">
               <div className="flex flex-col space-y-6">
                  <div className="bg-gray-50/50 rounded-[2rem] p-5 sm:p-6 border border-gray-100">
                    <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-4">{t('taskDetails')}</h4>
                    <div className="space-y-4 text-sm font-light">
                       {selectedTaskModal.policyNumber && (
                         <div><span className="text-gray-400 block text-[11px] mb-0.5">{t('policyNumber')}</span><span className="text-gray-800">{selectedTaskModal.policyNumber}</span></div>
                       )}
                       <div><span className="text-gray-400 block text-[11px] mb-0.5">{t('serviceType')}</span><span className="text-gray-800">{t(selectedTaskModal.serviceType)}</span></div>
                       <div><span className="text-gray-400 block text-[11px] mb-0.5">{t('colFa')}</span><span className="text-gray-800">{selectedTaskModal.faName}</span></div>
                       <div><span className="text-gray-400 block text-[11px] mb-0.5">{t('dueDate')}</span><span className="text-orange-600">{selectedTaskModal.dueDate ? new Date(selectedTaskModal.dueDate).toLocaleDateString('th-TH') : '-'}</span></div>
                    </div>
                  </div>

                  {selectedTaskModal.attachments && selectedTaskModal.attachments.length > 0 && (
                    <div className="bg-gray-50/50 rounded-[2rem] p-5 sm:p-6 border border-gray-100">
                      <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-4">{t('attachFiles').replace(/^[0-9]\.\s*/, '')}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedTaskModal.attachments.map((file, idx) => {
                          const isImg = file.url.match(/\.(jpeg|jpg|gif|png|webp)/i) || file.url.includes('images%2F') || file.type?.startsWith('image/');
                          return (
                            <div key={idx} className="border border-gray-200 rounded-xl p-2 flex flex-col items-center bg-white hover:border-[#DEFF00] hover:shadow-sm transition-all group overflow-hidden cursor-pointer" onClick={() => isImg ? setFullscreenImage(file.url) : window.open(file.url, '_blank')}>
                              {isImg ? (
                                <img src={file.url} alt="attachment" className="w-full h-24 object-cover rounded-lg mb-2" />
                              ) : (
                                <div className="w-full h-24 flex items-center justify-center bg-gray-50 rounded-lg mb-2 group-hover:bg-[#DEFF00]/10 transition-colors">
                                  <FileText className="w-8 h-8 text-gray-400 group-hover:text-[#161A22]" />
                                </div>
                              )}
                              <span className="text-[9px] text-gray-500 text-center truncate w-full font-light px-1">{file.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(userProfile?.role === 'Admin' || userProfile?.role === 'Executive') && (
                    <div className="bg-gray-50/50 rounded-[2rem] p-5 sm:p-6 border border-gray-100">
                      <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-3">{t('updateStatus')} (Admin)</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {KANBAN_COLUMNS.map(c => <button key={c.id} disabled={actionLoading[`status-${selectedTaskModal.id}`]} onClick={()=>handleUpdateStatus(selectedTaskModal.id, c.id)} className={`py-2.5 px-2 text-[11px] font-medium rounded-xl transition-all border ${selectedTaskModal.status===c.id ? 'bg-[#DEFF00] text-gray-800 border-[#DEFF00] shadow-sm' : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'}`}>{t(c.tKey)}</button>)}
                      </div>
                      
                      {/* เมนูเปลี่ยนผู้รับผิดชอบ (สำหรับแอดมินและผู้บริหาร) */}
                      <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-3 mt-5">โอนย้ายงาน / เปลี่ยนผู้รับผิดชอบ</h4>
                      <select
                        disabled={actionLoading[`assignee-${selectedTaskModal.id}`]}
                        value={selectedTaskModal.faUid}
                        onChange={(e) => {
                          if(window.confirm('ยืนยันการโอนย้ายงานนี้ให้ผู้รับผิดชอบคนใหม่ใช่หรือไม่?')){
                            handleChangeAssignee(selectedTaskModal.id, e.target.value);
                          }
                        }}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-light appearance-none outline-none focus:border-[#DEFF00] cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        {allAvailableFAs.map(fa => (
                          <option key={fa.uid} value={fa.uid}>{fa.name} ({fa.role || 'FA'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {userProfile?.role === 'Executive' && (
                    <div className="flex justify-end mt-4 pb-8">
                      {deleteConfirmId === selectedTaskModal.id ? (
                        <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full border border-red-100">
                          <span className="text-xs text-red-600 font-medium">{t('confirmDelete')}</span>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1 bg-white text-gray-500 rounded-full text-xs font-medium hover:bg-gray-100 border border-gray-200">{t('cancel')}</button>
                          <button onClick={() => handleDeleteTask(selectedTaskModal.id)} className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-medium hover:bg-red-600 flex items-center gap-1">
                            {actionLoading[`delete-${selectedTaskModal.id}`] ? <Loader2 className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3"/>} {t('deletePermanent')}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(selectedTaskModal.id)} className="flex items-center gap-1.5 px-4 py-2 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full font-medium transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> {t('deleteTask')}
                        </button>
                      )}
                    </div>
                  )}
               </div>

               <div className="flex flex-col bg-gray-50/50 rounded-[2rem] p-5 sm:p-6 border border-gray-100 h-[400px] sm:h-full min-h-[400px]">
                  <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-4">{t('chatHistory')}</h4>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {(!selectedTaskModal.messages || selectedTaskModal.messages.length===0) ? <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60"><MessageSquare className="w-8 h-8 mb-2 stroke-[1.5]"/><span className="text-xs font-light">{t('noChatHistory')}</span></div> : 
                      selectedTaskModal.messages.map((msg, idx) => {
                        const isMe = msg.senderName === userProfile?.name;
                        const isSystem = msg.senderName === 'System';
                        
                        if (isSystem) {
                          return (
                            <div key={idx} className="flex justify-center my-4">
                              <span className="bg-gray-100/80 text-gray-500 text-[10px] font-medium px-4 py-1.5 rounded-full border border-gray-200">
                                {msg.text}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] text-gray-400 font-light mb-1 ml-1 tracking-wider uppercase">{msg.senderName} ({msg.senderRole})</span>
                            <div className={`px-4 py-3 rounded-2xl text-sm font-light leading-relaxed max-w-[90%] sm:max-w-[85%] shadow-sm border border-white/50 ${isMe ? 'bg-[#DEFF00] text-gray-900 rounded-tr-sm shadow-sm' : 'bg-white text-gray-800 rounded-tl-sm shadow-sm'}`}>
                              {msg.text}
                              {msg.attachmentUrl && (
                                <div className="mt-3 block pb-1">
                                  {(msg.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) || msg.attachmentType?.startsWith('image/')) ? 
                                    <div className="rounded-xl overflow-hidden border border-black/5 bg-black/5 flex justify-center items-center p-3">
                                        <img src={msg.attachmentUrl} alt="attachment" onClick={() => setFullscreenImage(msg.attachmentUrl)} className="max-h-[200px] w-auto object-contain rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity" />
                                    </div> :
                                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1.5 mt-1 bg-white/50 px-3 py-2 rounded-lg border border-white"><Paperclip className="w-3.5 h-3.5"/> {msg.attachmentName || t('downloadAttach')}</a>
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    }
                    <div ref={taskChatEndRef} />
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 items-center bg-white p-1.5 rounded-full shadow-sm border border-gray-50 shrink-0">
                    <label className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full cursor-pointer transition-colors shrink-0" title={t('attachFileText')}>
                       {isUploadingChatFile ? <Loader2 className="w-4 h-4 animate-spin"/> : <ImageIcon className="w-4 h-4 stroke-[1.5]" />}
                       <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleUploadChatFile(selectedTaskModal.id, e)} disabled={isUploadingChatFile} />
                    </label>
                    <input type="text" value={chatInputs[selectedTaskModal.id]||''} onChange={e=>setChatInputs(p=>({...p, [selectedTaskModal.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleSendMessage(selectedTaskModal.id)} placeholder={t('typeMessage')} className="flex-1 bg-transparent px-2 text-sm font-light outline-none text-gray-800"/>
                    <button disabled={actionLoading[`chat-${selectedTaskModal.id}`] || !chatInputs[selectedTaskModal.id]?.trim()} onClick={()=>handleSendMessage(selectedTaskModal.id)} className="w-10 h-10 bg-[#161A22] text-[#DEFF00] rounded-full flex items-center justify-center shrink-0 hover:bg-black transition-colors disabled:opacity-50"><Send className="w-4 h-4 ml-0.5 stroke-[1.5]"/></button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#161A22]/20 backdrop-blur-sm" onClick={() => setShowAssignModal(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_10px_50px_rgba(0,0,0,0.1)] overflow-hidden animate-[fadeIn_0.2s_ease-out]">
             <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-800">{t('assignTask')}</h3>
                <button onClick={() => setShowAssignModal(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"><X className="w-4 h-4 stroke-[1.5]"/></button>
             </div>
             <form onSubmit={handleAssignSubmit} className="p-8 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-widest">{t('assignTo')}</label>
                  <select required value={assignForm.faUid} onChange={e=>setAssignForm({...assignForm, faUid:e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-light appearance-none outline-none">
                    <option value="" disabled>{t('selectFa')}</option>
                    {allAvailableFAs.map(fa=><option key={fa.uid} value={fa.uid}>{fa.name} ({fa.role || 'FA'})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-widest">{t('clientName')}</label>
                  <input required type="text" value={assignForm.clientName} onChange={e=>setAssignForm({...assignForm, clientName:e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-light outline-none" placeholder={t('clientName')} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-widest">{t('policyNumber')}</label>
                  <input type="text" value={assignForm.policyNumber} onChange={e=>setAssignForm({...assignForm, policyNumber:e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-light outline-none" placeholder={t('policyNumber')} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-widest">{t('serviceType')}</label>
                  <select value={assignForm.serviceType} onChange={e=>setAssignForm({...assignForm, serviceType:e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-light appearance-none outline-none">{TASK_TYPES.map(type=><option key={type} value={type}>{t(type)}</option>)}</select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-widest">{t('orderDetails')}</label>
                  <textarea rows="3" value={assignForm.notes} onChange={e=>setAssignForm({...assignForm, notes:e.target.value})} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-light resize-none outline-none" placeholder={t('typeMessage')}></textarea>
                </div>
                <button type="submit" disabled={assigningTask} className="w-full bg-[#161A22] text-[#DEFF00] py-4 rounded-full font-medium text-sm hover:bg-black transition-colors mt-2 flex justify-center items-center gap-2">
                  {assigningTask ? <><Loader2 className="w-4 h-4 animate-spin"/> กำลังดำเนินการ...</> : t('confirmAssign')}
                </button>
             </form>
          </div>
        </div>
      )}

      <nav className="pt-6 pb-4 px-4 sm:px-10 max-w-[1500px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 relative z-[990]">
        <div className="flex flex-col sm:items-start text-center sm:text-left">
           <span className="text-3xl font-medium tracking-tight text-[#161A22] leading-none mb-1">MCDJ</span>
           <span className="text-[9px] font-light tracking-[0.4em] text-gray-500 uppercase">WEALTH ADVISOR</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="bg-white p-1 flex gap-1 rounded-full shadow-[0_2px_15px_rgb(0,0,0,0.02)] border border-gray-50 overflow-x-auto w-full sm:w-auto justify-center">
            <button onClick={() => setActiveTab('front')} className={`px-5 py-2 text-[11px] font-medium rounded-full transition-all whitespace-nowrap ${activeTab === 'front' ? 'bg-[#DEFF00] text-[#161A22]' : 'text-gray-400 hover:text-gray-700'}`}>{t('faView')}</button>
            {(userProfile?.role === "Admin" || userProfile?.role === "Executive") && <button onClick={() => setActiveTab('back')} className={`px-5 py-2 text-[11px] font-medium rounded-full transition-all whitespace-nowrap ${activeTab === 'back' ? 'bg-[#DEFF00] text-[#161A22]' : 'text-gray-400 hover:text-gray-700'}`}>{t('adminView')}</button>}
            {userProfile?.role === "Executive" && <button onClick={() => setActiveTab('dashboard')} className={`px-5 py-2 text-[11px] font-medium rounded-full transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-[#DEFF00] text-[#161A22]' : 'text-gray-400 hover:text-gray-700'}`}>{t('execView')}</button>}
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto justify-center">
            
            {userProfile && (
              <button 
                onClick={handleLinkLine} 
                className={`px-5 py-2 rounded-full text-[11px] font-medium shadow-[0_2px_15px_rgb(0,0,0,0.02)] border flex items-center gap-2 transition-all active:scale-95 ${
                  userProfile.lineUserId 
                    ? 'bg-green-50 text-green-600 border-green-200' 
                    : 'bg-[#06C755] text-white border-[#06C755] hover:bg-[#05b04b]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full bg-current ${!userProfile.lineUserId && 'animate-pulse'}`}></span>
                {userProfile.lineUserId ? t('lineLinked') : t('linkLine')}
              </button>
            )}

            <div className="relative z-[1000]">
              <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="bg-white px-4 py-2 rounded-full text-[11px] font-medium text-gray-600 shadow-[0_2px_15px_rgb(0,0,0,0.02)] border border-gray-50 flex items-center gap-2 hover:bg-gray-50 transition-colors h-full relative">
                <Globe className="w-3.5 h-3.5 text-gray-400"/> {language}
              </button>
              {isLangMenuOpen && (
                <div className="absolute top-[120%] right-0 bg-white border border-gray-50 shadow-[0_10px_40px_rgb(0,0,0,0.08)] rounded-2xl overflow-hidden w-24 py-2 animate-[fadeIn_0.1s_ease-out]">
                   {['TH', 'EN', 'JP'].map(l => (
                     <button key={l} onClick={() => { setLanguage(l); setIsLangMenuOpen(false); }} className={`block w-full text-center px-4 py-2.5 text-[11px] font-medium transition-colors ${language === l ? 'bg-gray-50 text-[#161A22]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>{l}</button>
                   ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-white py-1.5 px-5 rounded-full shadow-[0_2px_15px_rgb(0,0,0,0.02)] border border-gray-50">
              <div className="text-right pr-3 border-r border-gray-100">
                <p className="text-[11px] font-medium text-[#161A22]">{userProfile?.name}</p>
                <p className="text-[8px] font-light text-gray-400 uppercase tracking-widest mt-0.5">{userProfile?.role}</p>
              </div>
              <button onClick={() => signOut(auth)} className="text-gray-300 hover:text-red-500 transition-colors"><LogOut className="w-3.5 h-3.5 stroke-[1.5]" /></button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-10 mt-2 relative z-10">
        
        {activeTab === "front" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            <div className="lg:col-span-4">
              <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-gray-50 sticky top-8">
                <h3 className="text-lg font-medium text-gray-800 mb-6">{t('createTask')}</h3>
                
                <div className="flex bg-gray-50 p-1.5 rounded-full mb-6">
                  <button onClick={() => setFrontFormMode('private')} className={`flex-1 rounded-full py-2.5 text-[11px] font-medium transition-all ${frontFormMode === 'private' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{t('privateTask')}</button>
                  <button onClick={() => setFrontFormMode('backend')} className={`flex-1 rounded-full py-2.5 text-[11px] font-medium transition-all ${frontFormMode === 'backend' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{t('backendTask')}</button>
                </div>

                <form onSubmit={handleSubmitTask} className="space-y-4 sm:space-y-5">
                  <div><input required type="text" value={clientName} onChange={e=>setClientName(e.target.value)} className="w-full px-5 py-3.5 bg-white border border-gray-100 rounded-full text-sm font-light text-gray-800 outline-none focus:border-[#DEFF00] transition-colors" placeholder={t('clientName')} /></div>
                  <div><input type="text" value={policyNumber} onChange={e=>setPolicyNumber(e.target.value)} className="w-full px-5 py-3.5 bg-white border border-gray-100 rounded-full text-sm font-light text-gray-800 outline-none focus:border-[#DEFF00] transition-colors" placeholder={t('policyNumber')} /></div>
                  <div>
                    <select value={serviceType} onChange={e=>setServiceType(e.target.value)} className="w-full px-5 py-3.5 bg-white border border-gray-100 rounded-full text-sm font-light text-gray-800 appearance-none outline-none focus:border-[#DEFF00] transition-colors">
                      {TASK_TYPES.map(type=><option key={type} value={type}>{t(type)}</option>)}
                    </select>
                  </div>
                  <div><input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full px-5 py-3.5 bg-white border border-gray-100 rounded-full text-sm font-light text-gray-800 outline-none focus:border-[#DEFF00] transition-colors" placeholder={t('dueDate')} /></div>
                  <div>
                    <div className="flex bg-white border border-gray-100 p-1.5 rounded-full">
                      <button type="button" onClick={()=>setUrgency('ปกติ')} className={`flex-1 py-2 rounded-full text-[11px] font-medium transition-colors ${urgency==='ปกติ'?'bg-gray-50 text-gray-800':'bg-transparent text-gray-400'}`}>{t('normal')}</button>
                      <button type="button" onClick={()=>setUrgency('ด่วน')} className={`flex-1 py-2 rounded-full text-[11px] font-medium transition-colors ${urgency==='ด่วน'?'bg-red-50 text-red-600':'bg-transparent text-gray-400'}`}>{t('urgent')}</button>
                    </div>
                  </div>
                  <div><textarea rows="3" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-[1.5rem] text-sm font-light text-gray-800 resize-none outline-none focus:border-[#DEFF00] transition-colors" placeholder={t('details')}></textarea></div>
                  <div>
                    <label className="flex flex-col items-center justify-center w-full border border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-50 rounded-[2rem] p-5 cursor-pointer transition-colors">
                      <Camera className="w-5 h-5 text-gray-400 mb-2 stroke-[1.5]"/><span className="text-[11px] text-gray-500 font-light">{t('attach')}</span>
                      <input type="file" multiple className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                    </label>
                    {filesToUpload.length > 0 && <div className="mt-2 space-y-2">{filesToUpload.map((f,i)=><div key={i} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-[11px] font-light border border-gray-100 text-gray-600"><span className="truncate pr-2">{f.name}</span><button type="button" onClick={()=>removeFile(i)} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5"/></button></div>)}</div>}
                  </div>
                  <button type="submit" disabled={submittingTask} className="w-full bg-[#DEFF00] text-[#161A22] font-medium text-sm py-4 rounded-full mt-2 hover:shadow-[0_4px_20px_rgba(222,255,0,0.3)] transition-all active:scale-[0.98]">{submittingTask? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> {t('submit')}...</span> : t('submit')}</button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
               <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-gray-50">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                    <h3 className="text-lg font-medium text-gray-800">{t('myTasks')}</h3>
                    <div className="bg-gray-50 p-1 rounded-full flex w-full sm:w-auto overflow-x-auto">
                      <button onClick={()=>setFaSubTab('tasks')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-full text-[11px] font-medium transition-colors ${faSubTab === 'tasks' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('taskBoard')}</button>
                      <button onClick={()=>setFaSubTab('calendar')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-full text-[11px] font-medium transition-colors ${faSubTab === 'calendar' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('calendar')}</button>
                    </div>
                  </div>

                  {faSubTab === 'tasks' ? (
                    <div className="flex flex-col md:flex-row justify-between gap-4 animate-[fadeIn_0.3s_ease-out]">
                      <div className="flex bg-gray-50 p-1 rounded-full w-full md:w-fit">
                        <button onClick={() => setFrontListMode('private')} className={`flex-1 px-5 py-2 rounded-full text-[10px] font-medium transition-all ${frontListMode === 'private' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>{t('privateTask')}</button>
                        <button onClick={() => setFrontListMode('backend')} className={`flex-1 px-5 py-2 rounded-full text-[10px] font-medium transition-all ${frontListMode === 'backend' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>{t('backendTask')}</button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {renderDateFilters()}
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                          <input type="text" placeholder={t('searchClient')} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="bg-white border border-gray-100 w-full sm:w-56 pl-10 pr-4 py-2.5 rounded-full text-[11px] font-light outline-none hover:border-gray-300 focus:border-[#DEFF00] text-gray-800 transition-colors" />
                        </div>
                      </div>
                    </div>
                  ) : null}
               </div>

               {faSubTab === 'calendar' && renderCalendarView()}

               {faSubTab === 'tasks' && (
                 <div className="animate-[fadeIn_0.3s_ease-out]">
                   <h4 className="font-medium text-gray-800 flex items-center gap-2 mb-4 text-sm ml-1"><LayoutDashboard className="w-4 h-4 text-gray-400 stroke-[1.5]"/> {t('taskBoard')}</h4>
                   <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 custom-scrollbar snap-x">
                      {KANBAN_COLUMNS.map(c => {
                        const colTasks = filteredTasks.filter(t=>t.status===c.id);
                        return (
                          <div key={c.id} className="min-w-[260px] sm:min-w-[280px] bg-white rounded-[2rem] p-4 sm:p-5 shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-gray-50 flex flex-col max-h-[400px] snap-center">
                            <div className="flex justify-between items-center mb-4 px-1">
                              <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${c.badgeColor}`}></div><span className="font-medium text-gray-700 text-xs sm:text-[13px]">{t(c.tKey)}</span></div>
                              <span className="text-gray-400 text-[10px] bg-gray-50 px-2.5 py-1 rounded-full font-medium">{colTasks.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                              {colTasks.length === 0 ? <div className="text-center py-8 text-gray-300 text-[11px] font-light border border-dashed border-gray-100 rounded-2xl">{t('empty')}</div> :
                                colTasks.map(task => (
                                  <div key={task.id} onClick={() => setSelectedTaskModal(task)} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 cursor-pointer hover:bg-white hover:border-[#DEFF00] hover:shadow-sm transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-[9px] text-gray-400 font-medium tracking-widest uppercase">#{task.trackingId || task.id.slice(-6).toUpperCase()}</span>
                                      {task.urgency === 'ด่วน' && <span className="text-[9px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">{t('urgent')}</span>}
                                    </div>
                                    <p className="font-medium text-gray-800 text-[13px] mb-1">{task.clientName}</p>
                                    <p className="text-[10px] text-gray-500 font-light truncate">{t(task.serviceType)}</p>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        )
                      })}
                   </div>

                   <div className="mt-4 sm:mt-6">
                     <h4 className="font-medium text-gray-800 mb-2 text-sm ml-1">{t('allTasks')}</h4>
                     {renderTaskTable(filteredTasks)}
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {(activeTab === "back" && (userProfile?.role === "Admin" || userProfile?.role === "Executive")) && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-gray-50 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-xl font-medium text-gray-800 flex items-center gap-3"><LayoutDashboard className="w-5 h-5 text-gray-400 stroke-[1.5]"/> {t('taskBoard')} (Admin)</h2>
                <div className="bg-gray-50 p-1 rounded-full flex sm:ml-4 w-full sm:w-auto">
                  <button onClick={()=>setAdminSubTab('tasks')} className={`flex-1 sm:flex-none px-5 py-2 rounded-full text-[11px] font-medium transition-colors ${adminSubTab === 'tasks' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('taskBoard')}</button>
                  <button onClick={()=>setAdminSubTab('calendar')} className={`flex-1 sm:flex-none px-5 py-2 rounded-full text-[11px] font-medium transition-colors ${adminSubTab === 'calendar' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('calendar')}</button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={()=>setShowAssignModal(true)} className="bg-[#161A22] text-[#DEFF00] px-6 py-2.5 rounded-full text-[11px] font-medium flex items-center justify-center gap-2 hover:bg-black transition-colors"><Plus className="w-3.5 h-3.5"/> {t('assignTask')}</button>
                <select value={selectedFaFilter} onChange={e=>setSelectedFaFilter(e.target.value)} className="bg-white border border-gray-100 px-5 py-2.5 rounded-full text-[11px] font-light text-gray-700 outline-none hover:bg-gray-50 cursor-pointer"><option value="all">{t('allFa')}</option>{allAvailableFAs.map(fa=><option key={fa.uid} value={fa.uid}>{fa.name}</option>)}</select>
                {renderDateFilters()}
              </div>
            </div>

            {adminSubTab === 'calendar' && renderCalendarView()}

            {adminSubTab === 'tasks' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                 <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 custom-scrollbar snap-x">
                    {KANBAN_COLUMNS.map(c => {
                      const colTasks = filteredTasks.filter(t=>t.status===c.id);
                      return (
                        <div key={c.id} className="min-w-[280px] sm:min-w-[300px] bg-white rounded-[2rem] p-4 sm:p-5 shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-gray-50 flex flex-col max-h-[500px] snap-center">
                          <div className="flex justify-between items-center mb-4 px-1">
                            <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${c.badgeColor}`}></div><span className="font-medium text-gray-700 text-xs sm:text-[13px]">{t(c.tKey)}</span></div>
                            <span className="text-gray-400 text-[10px] bg-gray-50 px-2.5 py-1 rounded-full font-medium">{colTasks.length}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                            {colTasks.length === 0 ? <div className="text-center py-8 text-gray-300 text-[11px] font-light border border-dashed border-gray-100 rounded-2xl">{t('empty')}</div> :
                              colTasks.map(task => (
                                <div key={task.id} onClick={() => setSelectedTaskModal(task)} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 cursor-pointer hover:bg-white hover:border-[#DEFF00] hover:shadow-sm transition-all">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[9px] text-gray-400 font-medium tracking-widest uppercase">#{task.trackingId || task.id.slice(-6).toUpperCase()}</span>
                                    {task.urgency === 'ด่วน' && <span className="text-[9px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">{t('urgent')}</span>}
                                  </div>
                                  <p className="font-medium text-gray-800 text-[13px] mb-1">{task.clientName}</p>
                                  <p className="text-[10px] text-gray-500 font-light truncate">{t(task.serviceType)}</p>
                                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                                     <span className="text-[9px] bg-white border border-gray-100 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gray-400"/> {task.faName?.split(' ')[0]}</span>
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )
                    })}
                 </div>
                 {renderTaskTable(filteredTasks)}
              </div>
            )}
          </div>
        )}

        {(activeTab === "dashboard" && userProfile?.role === "Executive") && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-4 sm:mb-8">
              <div>
                <h2 className="text-[24px] sm:text-[28px] font-medium text-[#161A22] tracking-tight mb-2">{t('dashboard')}</h2>
                <p className="text-[10px] sm:text-[11px] font-light text-gray-500 uppercase tracking-widest">{t('execSubtitle')}</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                 <div className="bg-white p-1 rounded-full flex sm:mr-2 shadow-[0_2px_15px_rgb(0,0,0,0.02)] border border-gray-50 w-full sm:w-auto">
                    <button onClick={()=>setExecSubTab('dashboard')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-full text-[11px] font-medium transition-colors ${execSubTab === 'dashboard' ? 'bg-gray-50 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('dashboard')}</button>
                    <button onClick={()=>setExecSubTab('calendar')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-full text-[11px] font-medium transition-colors ${execSubTab === 'calendar' ? 'bg-gray-50 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{t('calendar')}</button>
                 </div>
                 <button onClick={()=>setShowAssignModal(true)} className="w-full sm:w-auto bg-[#161A22] text-[#DEFF00] px-6 py-3 rounded-full text-[11px] font-medium flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-sm"><Plus className="w-3.5 h-3.5"/> {t('assignTask')}</button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <select value={selectedFaFilter} onChange={e=>setSelectedFaFilter(e.target.value)} className="bg-white px-5 py-2.5 rounded-full text-[11px] font-light border border-gray-50 shadow-[0_2px_15px_rgb(0,0,0,0.02)] text-gray-700 outline-none hover:bg-gray-50 cursor-pointer w-full sm:w-auto"><option value="all">{t('allFa')}</option>{allAvailableFAs.map(fa=><option key={fa.uid} value={fa.uid}>{fa.name}</option>)}</select>
                <div className="bg-white p-1 rounded-full border border-gray-50 shadow-[0_2px_15px_rgb(0,0,0,0.02)] w-full sm:w-auto">
                  {renderDateFilters()}
                </div>
            </div>
            
            {execSubTab === 'calendar' && renderCalendarView()}

            {execSubTab === 'dashboard' && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                   <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-gray-50 h-32 sm:h-40 flex flex-col justify-between">
                     <span className="text-[9px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-widest">{t('totalTasks')}</span>
                     <span className="text-4xl sm:text-5xl font-light text-[#161A22]">{filteredTasks.length}</span>
                   </div>
                   <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-gray-50 h-32 sm:h-40 flex flex-col justify-between">
                     <span className="text-[9px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-widest">{t('statusPending')}</span>
                     <span className="text-4xl sm:text-5xl font-light text-[#161A22]">{filteredTasks.filter(t=>t.status==='Pending').length}</span>
                   </div>
                   <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-gray-50 h-32 sm:h-40 flex flex-col justify-between border-b-4 border-[#DEFF00]">
                     <span className="text-[9px] sm:text-[10px] font-medium text-gray-500 uppercase tracking-widest">{t('statusInProgress')}</span>
                     <span className="text-4xl sm:text-5xl font-medium text-[#161A22]">{filteredTasks.filter(t=>t.status==='In Progress').length}</span>
                   </div>
                   <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-gray-50 h-32 sm:h-40 flex flex-col justify-between">
                     <span className="text-[9px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-widest">{t('statusApproved')}</span>
                     <span className="text-4xl sm:text-5xl font-light text-[#161A22]">{filteredTasks.filter(t=>t.status==='Approved').length}</span>
                   </div>
                </div>
                <div className="mt-6 sm:mt-8">{renderTaskTable(filteredTasks)}</div>
              </div>
            )}
          </div>
        )}

      </div>

      {fullscreenImage && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setFullscreenImage(null)}>
          <button onClick={() => setFullscreenImage(null)} className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all"><X className="w-6 h-6"/></button>
          <img src={fullscreenImage} alt="fullscreen" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()} />
          <a href={fullscreenImage} target="_blank" rel="noopener noreferrer" className="absolute bottom-8 bg-white text-gray-900 px-6 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors shadow-lg" onClick={e=>e.stopPropagation()}><Download className="w-4 h-4"/> เปิดรูปต้นฉบับ / บันทึกภาพ</a>
        </div>
      )}

    </div>
  );
}
