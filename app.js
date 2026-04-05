
// ============================================================
// 🔧 GLOBAL STATE & CONFIGURATION
// ============================================================
const AppState = {
  role: 'teacher',
  currentPage: '',
  schoolID: null,
  schoolName: 'مدرسة ابن المعتم',
  
  // User Data
  parentName: '',
  teacherName: '',
  teacherSubject: '',
  teacherEmail: '',
  
  // Students
  students: [],
  parentStudentIndex: 0,
  
  // Academic Data
  gradesDB: {},
  attendanceDB: [],
  todayAttendance: [],
  announcements: [],
  homework: [],
  teachers: {},
  subjectCodes: {},
  unlockedSubjects: {},
  allowedTeacherEmails: [],
  
  // NEW FEATURES DATA
  schedule: [],
  studentPoints: {},
  studentNotes: {},
  studentPhotos: {},
  leaveRequests: [],
  chatMessages: [],
  notifications: [],
  monthlyReports: {},
  
  // Admin State
  isAdminMode: false,
  adminType: null,
  isSuperAdmin: false,
  adminSchoolID: null,
  allSchools: []
};

// ============================================================
// 🌙 THEME MANAGEMENT
// ============================================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
  showToast(`تم التبديل إلى الوضع ${newTheme === 'dark' ? 'الداكن' : 'الفاتح'}`);
}

function updateThemeIcon(theme) {
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    btn.title = theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن';
  }
}

// ============================================================
// 🔄 INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await initializeApp();
});

async function initializeApp() {
  showLoading(true);
  
  try {
    // Check URL parameters for school ID
    const urlParams = new URLSearchParams(window.location.search);
    const urlSchoolID = urlParams.get('id');
    
    if (urlSchoolID) {
      AppState.schoolID = urlSchoolID;
      sessionStorage.setItem('activeSchoolID', urlSchoolID);
      await loadSchoolData();
      sessionStorage.setItem('activeSchoolName', AppState.schoolName);
      navigateToScreen('login');
    } else {
      // Check session storage
      const savedSchoolID = sessionStorage.getItem('activeSchoolID');
      const savedSchoolName = sessionStorage.getItem('activeSchoolName');
      
      if (savedSchoolID) {
        AppState.schoolID = savedSchoolID;
        AppState.schoolName = savedSchoolName || AppState.schoolName;
        await loadSchoolData();
        navigateToScreen('login');
      } else {
        await loadSchoolsList();
      }
    }
    
    // Show welcome modal for first-time users
    setTimeout(() => {
      if (!localStorage.getItem('welcomeShown')) {
        document.getElementById('welcomeModal').style.display = 'flex';
      }
    }, 1000);
    
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('حدث خطأ أثناء التحميل', 'error');
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  console.log(show ? 'Loading...' : 'Loaded');
}

// ============================================================
// 🏫 SCHOOL SELECTION
// ============================================================
async function loadSchoolsList() {
  await waitForFirebase();
  
  try {
    const container = document.getElementById('schoolListContainer');
    const snap = await window._getDoc(window._doc(window._db, 'platformConfig', 'schools'));
    
    if (snap.exists() && snap.data().list && snap.data().list.length > 0) {
      container.innerHTML = snap.data().list.map(school => `
        <div class="school-card" onclick="selectSchool('${escapeHTML(school.id)}', '${escapeHTML(school.name)}')">
          <div class="school-icon">🏫</div>
          <div class="school-name">${escapeHTML(school.name)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">اضغط للاختيار →</div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `
        <div style="text-align: center; opacity: 0.5; padding: 30px;">
          <p style="font-size: 48px; margin-bottom: 12px;">📭</p>
          <p>لا توجد مدارس مسجلة حالياً</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading schools:', error);
    document.getElementById('schoolListContainer').innerHTML = `
      <div style="text-align: center; opacity: 0.5; padding: 30px;">
        <p>❌ خطأ في تحميل القائمة</p>
        <button class="btn-link" onclick="loadSchoolsList()" style="margin-top: 12px;">إعادة المحاولة</button>
      </div>
    `;
  }
}

function quickAccessMode() {
  const id = prompt('أدخل ID المدرسة:');
  if (id && id.trim()) {
    selectSchool(id.trim(), id.trim());
  }
}

function showSchoolCodeInput() {
  document.getElementById('schoolListContainer').style.display = 'none';
  document.getElementById('schoolCodeInputWrap').style.display = 'block';
  document.getElementById('confirmSchoolBtn').style.display = 'block';
}

async function submitSchoolCode() {
  const code = document.getElementById('schoolCodeInput').value.trim();
  if (!code) return;
  
  try {
    await waitForFirebase();
    const snap = await window._getDoc(window._doc(window._db, 'schools', code));
    
    if (snap.exists()) {
      selectSchool(code, snap.data().name);
    } else {
      showToast('❌ كود المدرسة غير صحيح', 'error');
    }
  } catch (error) {
    showToast('❌ خطأ في البحث', 'error');
  }
}

async function selectSchool(id, name) {
  AppState.schoolID = id;
  AppState.schoolName = name;
  
  sessionStorage.setItem('activeSchoolID', id);
  sessionStorage.setItem('activeSchoolName', name);
  
  updateSchoolUI(name);
  navigateToScreen('login');
  
  showToast(`تم اختيار: ${name}`);
}

async function loadSchoolData() {
  if (!AppState.schoolID) return;
  
  try {
    await waitForFirebase();
    const snap = await window._getDoc(window._doc(window._db, 'schools', AppState.schoolID));
    
    if (snap.exists()) {
      const data = snap.data();
      AppState.schoolName = data.name || AppState.schoolName;
      
      // Load all data into state
      if (data.students) AppState.students = data.students;
      if (data.gradesDB) AppState.gradesDB = data.gradesDB;
      if (data.homework) AppState.homework = data.homework;
      if (data.announcements) AppState.announcements = data.announcements;
      if (data.subjectCodes) AppState.subjectCodes = data.subjectCodes;
      if (data.allowedTeacherEmails) AppState.allowedTeacherEmails = data.allowedTeacherEmails;
      if (data.attendanceDB) AppState.attendanceDB = data.attendanceDB;
      if (data.teachers) AppState.teachers = data.teachers;
      if (data.schedule) AppState.schedule = data.schedule;
      if (data.studentPoints) AppState.studentPoints = data.studentPoints;
      if (data.studentNotes) AppState.studentNotes = data.studentNotes;
      if (data.studentPhotos) AppState.studentPhotos = data.studentPhotos;
      if (data.leaveRequests) AppState.leaveRequests = data.leaveRequests;
      if (data.chatMessages) AppState.chatMessages = data.chatMessages;
      if (data.notifications) AppState.notifications = data.notifications;
      if (data.monthlyReports) AppState.monthlyReports = data.monthlyReports;
      
      // Save to IndexedDB for offline use
      saveToIndexedDB(AppState.schoolID, data);
    }
  } catch (error) {
    console.log('Could not load from cloud, trying local storage...');
    await loadFromIndexedDB(AppState.schoolID);
  }
}

function updateSchoolUI(name) {
  document.getElementById('loginSchoolTitle').textContent = name;
  document.getElementById('loginSchoolSubtitle').textContent = name + ' - التعليم الأساسي';
  document.getElementById('sidebarSchoolName').textContent = '🏫 ' + name;
}

// ============================================================
// 👤 LOGIN & AUTHENTICATION
// ============================================================
function selectRole(role) {
  AppState.role = role;
  
  document.getElementById('roleCardParent').classList.toggle('selected', role === 'parent');
  document.getElementById('roleCardTeacher').classList.toggle('selected', role === 'teacher');
}

function enterApplication() {
  if (AppState.role === 'parent') {
    navigateToScreen('code');
    loadCloudData().catch(() => {});
  } else {
    navigateToScreen('teacherLogin');
    loadCloudData().catch(() => {});
  }
}

function goBackToLogin() {
  navigateToScreen('login');
}

function goBackToLoginFromTeacher() {
  navigateToScreen('login');
}

// Password Login (Offline Capable)
async function loginWithPassword() {
  const username = document.getElementById('teacherUsername')?.value?.trim();
  const password = document.getElementById('teacherPassword')?.value?.trim();
  const errorEl = document.getElementById('teacherLoginError');
  
  if (!username || !password) {
    showError(errorEl, '❌ أدخل اسم المستخدم وكلمة المرور');
    return;
  }
  
  // Try local storage first (offline)
  const localUsers = JSON.parse(localStorage.getItem('teacherAccounts_' + AppState.schoolID) || '{}');
  
  if (localUsers[username] && localUsers[username].password === hashPassword(password)) {
    handleSuccessfulLogin(username, localUsers[username].name || username);
    return;
  }
  
  // Try Firebase (online)
  try {
    await waitForFirebase();
    const snap = await window._getDoc(window._doc(window._db, 'schools', AppState.schoolID, 'teachers', username));
    
    if (snap.exists() && snap.data().password === hashPassword(password)) {
      const teacherData = snap.data();
      
      // Cache locally for offline use
      localUsers[username] = { 
        password: hashPassword(password), 
        name: teacherData.name || username 
      };
      localStorage.setItem('teacherAccounts_' + AppState.schoolID, JSON.stringify(localUsers));
      
      handleSuccessfulLogin(username, teacherData.name || username);
    } else {
      showError(errorEl, '❌ اسم المستخدم أو كلمة المرور خاطئة');
    }
  } catch (error) {
    showError(errorEl, '❌ لا يوجد اتصال بالإنترنت — سجّل مرة أولى بالنت');
  }
}

// Simple hash function for passwords (in production, use proper bcrypt)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hashed_' + Math.abs(hash).toString(36);
}

function showError(element, message) {
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 3000);
}

function hideError(element) {
  element.classList.remove('show');
}

// Google Sign-In
async function handleGoogleSignIn() {
  try {
    const provider = new window._GoogleAuthProvider();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      await window._signInWithRedirect(window._auth, provider);
    } else {
      const result = await window._signInWithPopup(window._auth, provider);
      processGoogleAuthResult(result);
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    showError(document.getElementById('googleLoginError'), '❌ حدث خطأ في تسجيل الدخول');
  }
}

async function processGoogleAuthResult(result) {
  if (!result) return;
  
  const email = result.user.email;
  const name = result.user.displayName || email.split('@')[0];
  
  await loadCloudData();
  
  // Check if email is allowed (security feature)
  if (AppState.allowedTeacherEmails.length > 0 && !AppState.allowedTeacherEmails.includes(email)) {
    showError(document.getElementById('googleLoginError'), '❌ هذا البريد غير مسموح له بالدخول');
    await window._signOut(window._auth);
    return;
  }
  
  // Success!
  AppState.teacherEmail = email;
  AppState.teacherName = name;
  
  // Save to local cache
  const localUsers = JSON.parse(localStorage.getItem('teacherAccounts_' + AppState.schoolID) || '{}');
  if (!localUsers[email]) {
    localUsers[email] = { name, password: null, fromGoogle: true };
    localStorage.setItem('teacherAccounts_' + AppState.schoolID, JSON.stringify(localUsers));
  }
  
  enterMainApplication();
}

// Check redirect result for mobile Google login
async function checkGoogleRedirectResult() {
  await waitForFirebase();
  try {
    const result = await window._getRedirectResult(window._auth);
    if (result && result.user) {
      await loadCloudData();
      processGoogleAuthResult(result);
    }
  } catch (error) {
    console.log('Redirect result:', error);
  }
}
checkGoogleRedirectResult();

function handleSuccessfulLogin(email, name) {
  AppState.teacherEmail = email;
  AppState.teacherName = name;
  hideError(document.getElementById('teacherLoginError'));
  enterMainApplication();
}

// ============================================================
// 📱 PARENT CODE ENTRY
// ============================================================
function submitStudentCode() {
  const code = document.getElementById('studentCodeInput').value.trim();
  const studentIndex = AppState.students.findIndex(s => s.code === code);
  
  if (studentIndex === -1) {
    const errorEl = document.getElementById('codeError');
    errorEl.classList.add('show');
    document.getElementById('studentCodeInput').style.borderColor = 'var(--danger)';
    setTimeout(() => {
      errorEl.classList.remove('show');
      document.getElementById('studentCodeInput').style.borderColor = '';
    }, 2000);
    return;
  }
  
  AppState.parentStudentIndex = studentIndex;
  enterMainApplication();
}

// ============================================================
// 🏠 MAIN APPLICATION
// ============================================================
function enterMainApplication() {
  hideAllScreens();
  document.getElementById('appScreen').classList.add('active');
  applyUserRole();
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('adminPanel').classList.remove('active');
}

function navigateToScreen(screenId) {
  hideAllScreens();
  const screen = document.getElementById(screenId + 'Screen') || document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

// ============================================================
// 👤 USER ROLE & UI
// ============================================================
function applyUserRole() {
  const isParent = AppState.role === 'parent';
  
  // Update header
  document.getElementById('headerTitle').textContent = isParent ? 'بوابة أولياء الأمور' : 'منظور المدرس';
  document.getElementById('headerSubtitle').textContent = isParent ? 'ولي الأمر' : 'المدرس';
  
  // Update sidebar user info
  document.getElementById('sidebarUserName').textContent = isParent ? AppState.parentName : AppState.teacherName;
  document.getElementById('sidebarUserRole').textContent = isParent ? 'ولي الأمر' : AppState.teacherSubject || 'مدرس';
  
  // Update avatars
  const displayName = isParent ? AppState.parentName : AppState.teacherName;
  const initial = displayName ? displayName.charAt(0) : '?';
  const avatarColor = isParent 
    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' 
    : 'linear-gradient(135deg, #06b6d4, #0ea5e9)';
  
  setAvatarStyle('sidebarAvatar', avatarColor, initial);
  setAvatarStyle('headerAvatar', avatarColor, initial);
  
  // Update switch button
  document.getElementById('switchRoleIcon').textContent = isParent ? '👨‍🏫' : '👨‍👩‍👧';
  document.getElementById('switchRoleLabel').textContent = isParent 
    ? 'التبديل لمنظور المدرس' 
    : 'التبديل لمنظور ولي الأمر';
  
  // Build navigation
  buildSidebarNavigation();
  
  // Navigate to default page
  const defaultPage = isParent ? 'p-grades' : 't-dashboard';
  navigateToPage(defaultPage);
}

function setAvatarStyle(elementId, gradient, text) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.background = gradient;
    el.textContent = text;
  }
}

function switchUserRole() {
  AppState.role = AppState.role === 'parent' ? 'teacher' : 'parent';
  closeSidebar();
  applyUserRole();
  showToast(`تم التبديل إلى: ${AppState.role === 'parent' ? 'ولي الأمر' : 'المدرس'}`);
}

// ============================================================
// 📋 SIDEBAR NAVIGATION
// ============================================================
const parentNavItems = [
  { id: 'p-grades', icon: '🏆', label: 'الدرجات' },
  { id: 'p-progress-chart', icon: '📈', label: 'رسم التقدم' },
  { id: 'p-attendance', icon: '📅', label: 'الحضور' },
  { id: 'p-news', icon: '📢', label: 'الأخبار' },
  { id: 'p-homework', icon: '📚', label: 'الواجبات' },
  { id: 'p-monthly-report', icon: '📊', label: 'التقرير الشهري' },
  { id: 'p-leave-request', icon: '📝', label: 'طلب إجازة' },
  { id: 'p-chat', icon: '💬', label: 'رسائل المدرس' },
  { id: 'p-settings', icon: '⚙️', label: 'الإعدادات' }
];

const teacherNavItems = [
  { id: 't-dashboard', icon: '📊', label: 'لوحة التحكم' },
  { id: 't-grades', icon: '📝', label: 'إدخال درجات' },
  { id: 't-attendance', icon: '📅', label: 'تسجيل الحضور' },
  { id: 't-schedule', icon: '📆', label: 'جدول الحصص' },
  { id: 't-points', icon: '⭐', label: 'النقاط والمكافآت' },
  { id: 't-announce', icon: '📢', label: 'الإعلانات' },
  { id: 't-homework', icon: '📚', label: 'الواجبات' },
  { id: 't-students-notes', icon: '📒', label: 'ملاحظات الطلاب' },
  { id: 't-reports-pdf', icon: '🖨️', label: 'تقارير PDF' },
  { id: 't-statistics', icon: '📊', label: 'إحصائيات الفصل' },
  { id: 't-settings', icon: '⚙️', label: 'الإعدادات' }
];

function buildSidebarNavigation() {
  const navItems = AppState.role === 'parent' ? parentNavItems : teacherNavItems;
  const sectionTitle = AppState.role === 'parent' ? 'القائمة الرئيسية' : 'أدوات المدرس';
  
  const navHTML = `
    <div class="nav-section-title">${sectionTitle}</div>
    ${navItems.map(item => `
      <div class="nav-item" id="nav-${item.id}" onclick="navigateToPage('${item.id}'); closeSidebar();">
        <div class="nav-icon">${item.icon}</div>
        <div class="nav-label">${item.label}</div>
      </div>
    `).join('')}
  `;
  
  document.getElementById('sidebarNavigation').innerHTML = navHTML;
}

function openSidebar() {
  document.getElementById('mainSidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('mainSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ============================================================
// 📍 PAGE NAVIGATION
// ============================================================
function navigateToPage(pageId) {
  AppState.currentPage = pageId;
  
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById('nav-' + pageId);
  if (activeNav) activeNav.classList.add('active');
  
  // Render page content
  const mainContent = document.getElementById('mainContentArea');
  mainContent.innerHTML = '';
  
  switch (pageId) {
    // Parent Pages
    case 'p-grades': mainContent.innerHTML = renderParentGrades(); break;
    case 'p-progress-chart': mainContent.innerHTML = renderProgressChart(); break;
    case 'p-attendance': mainContent.innerHTML = renderParentAttendance(); break;
    case 'p-news': mainContent.innerHTML = renderParentNews(); break;
    case 'p-homework': mainContent.innerHTML = renderParentHomework(); break;
    case 'p-monthly-report': mainContent.innerHTML = renderMonthlyReport(); break;
    case 'p-leave-request': mainContent.innerHTML = renderLeaveRequestForm(); break;
    case 'p-chat': mainContent.innerHTML = renderParentChat(); break;
    case 'p-settings': mainContent.innerHTML = renderParentSettings(); break;
    
    // Teacher Pages
    case 't-dashboard': mainContent.innerHTML = renderTeacherDashboard(); break;
    case 't-grades': mainContent.innerHTML = renderTeacherGrades(); break;
    case 't-attendance': mainContent.innerHTML = renderTeacherAttendance(); break;
    case 't-schedule': mainContent.innerHTML = renderScheduleEditor(); break;
    case 't-points': mainContent.innerHTML = renderPointsSystem(); break;
    case 't-announce': mainContent.innerHTML = renderAnnouncementManager(); break;
    case 't-homework': mainContent.innerHTML = renderHomeworkManager(); break;
    case 't-students-notes': mainContent.innerHTML = renderStudentsNotes(); break;
    case 't-reports-pdf': mainContent.innerHTML = renderPDFReports(); break;
    case 't-statistics': mainContent.innerHTML = renderClassStatistics(); break;
    case 't-settings': mainContent.innerHTML = renderTeacherSettings(); break;
    
    default:
      mainContent.innerHTML = '<div class="card" style="text-align:center;padding:40px;"><p>الصفحة قيد التطوير 🚧</p></div>';
  }
}

// ============================================================
// 📊 PARENT: GRADES PAGE (FIXED SYNTAX ERROR)
// ============================================================
function renderParentGrades() {
  const subjects = Object.keys(AppState.gradesDB);
  const student = AppState.students[AppState.parentStudentIndex];
  const studentIdx = AppState.parentStudentIndex;
  
  if (!student) {
    return `<div class="card" style="text-align:center;padding:40px;opacity:0.6;">
      <p style="font-size:48px;margin-bottom:16px;">👤</p>
      <p>لم يتم اختيار طالب</p>
    </div>`;
  }
  
  // Calculate grades data
  const getRoundData = (sub, round) => (AppState.gradesDB[sub]?.[studentIdx]?.[round]) || {};
  
  const rows = subjects.map((subject, idx) => {
    const r1 = getRoundData(subject, 'r1');
    const r2 = getRoundData(subject, 'r2');
    const r1Final = r1.final ?? 0;
    const r2Final = r2.final ?? 0;
    
    return `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px 6px;">${idx + 1}</td>
        <td style="font-weight: 600; font-size: 14px; padding: 12px 10px;">${escapeHTML(subject)}</td>
        <td style="text-align: center; font-size: 12px; color: var(--text-muted); padding: 12px 6px;">${escapeHTML(AppState.teachers[subject] || '-')}</td>
        <td style="text-align: center; padding: 12px 6px;">
          <span style="font-weight: 800; font-size: 18px; color: ${getGradeColor(r1Final)};">${r1Final || '—'}</span>
          ${r1Final > 0 ? `<div style="font-size: 10px; color: ${getGradeColor(r1Final)}; margin-top: 2px;">${getGradeLabel(r1Final)}</div>` : ''}
        </td>
        <td style="text-align: center; padding: 12px 6px;">
          <span style="font-weight: 800; font-size: 18px; color: ${getGradeColor(r2Final)};">${r2Final || '—'}</span>
          ${r2Final > 0 ? `<div style="font-size: 10px; color: ${getGradeColor(r2Final)}; margin-top: 2px;">${getGradeLabel(r2Final)}</div>` : ''}
        </td>
      </tr>
    `;
  }).join('');
  
  // Calculate averages
  const calcAverage = round => {
    const finals = subjects.map(s => getRoundData(s, round).final ?? 0).filter(v => v > 0);
    return finals.length ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : 0;
  };
  
  const avg1 = calcAverage('r1');
  const avg2 = calcAverage('r2');
  
  return `
    ${renderStudentSelector()}
    
    <div class="export-bar">
      <button class="export-btn" onclick="printStudentReportPDF()">
        🖨️ طباعة / تصدير PDF
      </button>
      <button class="export-btn" onclick="exportToExcel()">
        📊 تصدير Excel
      </button>
    </div>
    
    <div class="stats-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="stat" style="border: 1px solid rgba(52,211,153,0.3);">
        <div class="stat-icon">📘</div>
        <div class="stat-value" style="color: #34d399;">${avg1 || '—'}</div>
        <div class="stat-label">معدل الدور الأول</div>
      </div>
      <div class="stat" style="border: 1px solid rgba(244,114,182,0.3);">
        <div class="stat-icon">📗</div>
        <div class="stat-value" style="color: #f472b6;">${avg2 || '—'}</div>
        <div class="stat-label">معدل الدور الثاني</div>
      </div>
    </div>
    
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="padding: 16px 18px; border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 15px;">
        🏆 نتائج الطالب — ${escapeHTML(student.name)}
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-family: inherit; direction: rtl;">
          <thead>
            <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--accent);">
              <th style="padding: 12px 6px; font-size: 11px; color: var(--text-muted); text-align: center; width: 36px;">#</th>
              <th style="padding: 12px 10px; font-size: 13px; text-align: right;">المادة</th>
              <th style="padding: 12px 10px; font-size: 12px; color: #34d399; text-align: center;">📘 الدور الأول</th>
              <th style="padding: 12px 10px; font-size: 12px; color: #f472b6; text-align: center;">📗 الدور الثاني</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="5" style="text-align: center; padding: 28px; opacity: 0.4;">لا توجد درجات بعد</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================
// 📈 PARENT: PROGRESS CHART (NEW FEATURE #12)
// ============================================================
function renderProgressChart() {
  const student = AppState.students[AppState.parentStudentIndex];
  if (!student) return '<div class="card"><p>لم يتم اختيار طالب</p></div>';
  
  const subjects = Object.keys(AppState.gradesDB);
  const studentIdx = AppState.parentStudentIndex;
  
  const labels = subjects.map(s => s.substring(0, 15));
  const dataR1 = subjects.map(s => AppState.gradesDB[s]?.[studentIdx]?.r1?.final || 0);
  const dataR2 = subjects.map(s => AppState.gradesDB[s]?.[studentIdx]?.r2?.final || 0);
  
  return `
    ${renderStudentSelector()}
    
    <div class="chart-container">
      <div class="chart-title">📈 رسم بياني لتطور درجات ${escapeHTML(student.name)}</div>
      <canvas id="progressChart" height="280"></canvas>
    </div>
    
    <div class="card">
      <div class="section-title">📋 ملخص الأداء</div>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-icon">📚</div>
          <div class="stat-value">${subjects.length}</div>
          <div class="stat-label">عدد المواد</div>
        </div>
        <div class="stat">
          <div class="stat-icon">🏆</div>
          <div class="stat-value">${Math.max(...dataR1.filter(v=>v>0), ...dataR2.filter(v=>v>0)) || '—'}</div>
          <div class="stat-label">أعلى درجة</div>
        </div>
        <div class="stat">
          <div class="stat-icon">📉</div>
          <div class="stat-value">${Math.min(...dataR1.filter(v=>v>0), ...dataR2.filter(v=>v>0)) || '—'}</div>
          <div class="stat-label">أدنى درجة</div>
        </div>
      </div>
    </div>
    
    <script>
      setTimeout(() => {
        const ctx = document.getElementById('progressChart')?.getContext('2d');
        if (ctx) {
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(labels)},
              datasets: [
                {
                  label: 'الدور الأول',
                  data: ${JSON.stringify(dataR1)},
                  backgroundColor: 'rgba(52,211,153,0.7)',
                  borderColor: '#34d399',
                  borderWidth: 2,
                  borderRadius: 6
                },
                {
                  label: 'الدور الثاني',
                  data: ${JSON.stringify(dataR2)},
                  backgroundColor: 'rgba(244,114,182,0.7)',
                  borderColor: '#f472b6',
                  borderWidth: 2,
                  borderRadius: 6
                }
              ]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { labels: { color: '#ccc', font: { family: 'IBM Plex Sans Arabic' } } }
              },
              scales: {
                y: { 
                  beginAtZero: true, 
                  max: 100,
                  ticks: { color: '#888' },
                  grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: { 
                  ticks: { color: '#888', font: { size: 10 } },
                  grid: { display: false }
              }
            }
          });
        }
      }, 100);
    </script>
  `;
}

// ============================================================
// 📅 PARENT: ATTENDANCE
// ============================================================
function renderParentAttendance() {
  const student = AppState.students[AppState.parentStudentIndex];
  if (!student) return '<div class="card"><p>لم يتم اختيار طالب</p></div>';
  
  const rows = AppState.attendanceDB.map(record => {
    const status = record.statuses[AppState.parentStudentIndex];
    let badgeClass = 'badge-warning';
    let statusText = status || '—';
    
    if (status === 'حاضر') badgeClass = 'badge-success';
    else if (status === 'غائب') badgeClass = 'badge-danger';
    else if (status === 'متأخر') badgeClass = 'badge-warning';
    
    return `
      <div class="card-dark" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; font-size: 14px;">${record.date}</span>
        <span class="badge ${badgeClass}">${statusText}</span>
      </div>
    `;
  }).join('');
  
  const presentCount = AppState.attendanceDB.filter(a => a.statuses[AppState.parentStudentIndex] === 'حاضر').length;
  const absentCount = AppState.attendanceDB.filter(a => a.statuses[AppState.parentStudentIndex] === 'غائب').length;
  const lateCount = AppState.attendanceDB.filter(a => a.statuses[AppState.parentStudentIndex] === 'متأخر').length;
  
  return `
    ${renderStudentSelector()}
    
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-icon">✅</div>
        <div class="stat-value" style="color: #22c55e;">${presentCount}</div>
        <div class="stat-label">أيام حضور</div>
      </div>
      <div class="stat">
        <div class="stat-icon">❌</div>
        <div class="stat-value" style="color: #ef4444;">${absentCount}</div>
        <div class="stat-label">أيام غياب</div>
      </div>
      <div class="stat">
        <div class="stat-icon">⏰</div>
        <div class="stat-value" style="color: #f59e0b;">${lateCount}</div>
        <div class="stat-label">تأخير</div>
      </div>
    </div>
    
    <div class="card">
      <div class="section-title">📅 سجل حضور ${escapeHTML(student.name)}</div>
      ${rows || '<div style="opacity: 0.4; text-align: center; padding: 24px;">لا توجد سجلات بعد</div>'}
    </div>
  `;
}

// ============================================================
// 📢 PARENT: NEWS/ANNOUNCEMENTS
// ============================================================
function renderParentNews() {
  const items = AppState.announcements.map(ann => `
    <div class="announcement-item">
      <div class="ann-icon-box">${ann.icon || '📢'}</div>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; flex-wrap: wrap; margin-bottom: 6px;">
          <span class="ann-title">${escapeHTML(ann.title)}</span>
          <span class="ann-date">${escapeHTML(ann.date || '')}</span>
        </div>
        <div class="ann-description">${escapeHTML(ann.desc)}</div>
      </div>
    </div>
  `).join('');
  
  return `
    <div class="card">
      <div class="section-title">📢 أخبار وإعلانات المدرسة</div>
      ${items || '<div style="opacity: 0.4; text-align: center; padding: 24px;">لا توجد إعلانات حالياً</div>'}
    </div>
  `;
}

// ============================================================
// 📚 PARENT: HOMEWORK
// ============================================================
function renderParentHomework() {
  const urgentCount = AppState.homework.filter(h => h.urgent).length;
  
  const items = AppState.homework.map(hw => `
    <div class="homework-item ${hw.urgent ? 'urgent' : ''}">
      <div class="hw-header">
        <span class="hw-subject">${escapeHTML(hw.subject || '—')}</span>
        <span class="hw-due-date ${hw.urgent ? 'urgent' : 'normal'}">التسليم: ${escapeHTML(hw.due || '')}</span>
      </div>
      <div class="hw-task">${escapeHTML(hw.task)}</div>
    </div>
  `).join('');
  
  return `
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-icon">📋</div>
        <div class="stat-value" style="color: #f59e0b;">${AppState.homework.length}</div>
        <div class="stat-label">واجبات</div>
      </div>
      <div class="stat">
        <div class="stat-icon">🔴</div>
        <div class="stat-value" style="color: #ef4444;">${urgentCount}</div>
        <div class="stat-label">عاجلة</div>
      </div>
      <div class="stat">
        <div class="stat-icon">✅</div>
        <div class="stat-value" style="color: #22c55e;">0</div>
        <div class="stat-label">منجزة</div>
      </div>
    </div>
    
    <div class="card">
      <div class="section-title">📚 الواجبات المطلوبة</div>
      ${items || '<div style="opacity: 0.4; text-align: center; padding: 24px;">لا توجد واجبات 🎉</div>'}
    </div>
  `;
}

// ============================================================
// 📊 PARENT: MONTHLY REPORT (NEW FEATURE #15)
// ============================================================
function renderMonthlyReport() {
  const student = AppState.students[AppState.parentStudentIndex];
  if (!student) return '<div class="card"><p>لم يتم اختيار طالب</p></div>';
  
  const currentMonth = new Date().toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' });
  
  return `
    ${renderStudentSelector()}
    
    <div class="card">
      <div class="section-title">📊 التقرير الشهري — ${currentMonth}</div>
      
      <div style="background: var(--bg-tertiary); border-radius: var(--radius); padding: 20px; margin-bottom: 16px;">
        <h4 style="margin-bottom: 12px; color: var(--accent);">ملخص الأداء الشهري</h4>
        
        <div class="stats-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="stat">
            <div class="stat-icon">📚</div>
            <div class="stat-value">85%</div>
            <div class="stat-label">نسبة الحضور</div>
          </div>
          <div class="stat">
            <div class="stat-icon">🏆</div>
            <div class="stat-value">78</div>
            <div class="stat-label">المعدل العام</div>
          </div>
          <div class="stat">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">${AppState.studentPoints[student.code] || 0}</div>
            <div class="stat-label">النقاط المكتسبة</div>
          </div>
          <div class="stat">
            <div class="stat-icon">📝</div>
            <div class="stat-value">${AppState.homework.length}</div>
            <div class="stat-label">واجبات مكتملة</div>
          </div>
        </div>
      </div>
      
      <div style="background: var(--bg-tertiary); border-radius: var(--radius); padding: 20px; margin-bottom: 16px;">
        <h4 style="margin-bottom: 12px; color: var(--info);">📈 مقارنة بالشهر السابق</h4>
        <ul style="line-height: 2; font-size: 14px; opacity: 0.8;">
          <li>✅ تحسن ملحوظ في المواد العلمية</li>
          <li>⚠️ يحتاج مراجعة في اللغة العربية</li>
          <li>🌟 أداء ممتاز في العلوم</li>
        </ul>
      </div>
      
      <div style="background: var(--bg-tertiary); border-radius: var(--radius); padding: 20px; margin-bottom: 16px;">
        <h4 style="margin-bottom: 12px; color: var(--success);">💡 توصيات المدرس</h4>
        <p style="line-height: 1.8; font-size: 14px; opacity: 0.8;">
          الطالب يظهر تحسناً ملحوظاً في المواد العلمية. ننصح بمزيد من القراءة وتخصيص وقت يومي للمراجعة. التواصل مع المدرس مرحب به دائماً.
        </p>
      </div>
      
      <div style="margin-top: 20px; text-align: center;">
        <button class="btn-action" onclick="downloadMonthlyReport()">
          📥 تحميل التقرير PDF
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// 📝 PARENT: LEAVE REQUEST (NEW FEATURE #13)
// ============================================================
function renderLeaveRequestForm() {
  const student = AppState.students[AppState.parentStudentIndex];
  if (!student) return '<div class="card"><p>لم يتم اختيار طالب</p></div>';
  
  const myRequests = AppState.leaveRequests.filter(r => 
    r.studentCode === student.code || r.studentName === student.name
  );
  
  const requestsHTML = myRequests.map(req => `
    <div class="card-dark" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 600; font-size: 14px;">${escapeHTML(req.reason || 'إجازة')}</div>
        <div style="font-size: 12px; opacity: 0.5;">${req.startDate} — ${req.endDate}</div>
      </div>
      <span class="request-status status-${req.status || 'pending'}">${
        req.status === 'approved' ? '✅ موافق عليه' :
        req.status === 'rejected' ? '❌ مرفوض' :
        '⏳ قيد المراجعة'
      }</span>
    </div>
  `).join('');
  
  return `
    ${renderStudentSelector()}
    
    <div class="leave-request-form">
      <div class="section-title">📝 طلب إجازة جديدة</div>
      
      <div class="form-group">
        <label class="form-label">سبب الإجازة</label>
        <input class="form-input" id="leaveReason" placeholder="مثال: مرض، سفر، مناسبة عائلية..."/>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group">
          <label class="form-label">من تاريخ</label>
          <input class="form-input" id="leaveStart" type="date"/>
        </div>
        <div class="form-group">
          <label class="form-label">إلى تاريخ</label>
          <input class="form-input" id="leaveEnd" type="date"/>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">ملاحظات إضافية (اختياري)</label>
        <textarea class="form-textarea" id="leaveNotes" placeholder="أي تفاصيل إضافية..."></textarea>
      </div>
      
      <button class="btn-success" onclick="submitLeaveRequest()">إرسال الطلب</button>
    </div>
    
    <div class="card">
      <div class="section-title">📋 طلباتي السابقة</div>
      ${requestsHTML || '<div style="opacity: 0.4; text-align: center; padding: 20px;">لا توجد طلبات سابقة</div>'}
    </div>
  `;
}

function submitLeaveRequest() {
  const student = AppState.students[AppState.parentStudentIndex];
  if (!student) return;
  
  const reason = document.getElementById('leaveReason')?.value?.trim();
  const startDate = document.getElementById('leaveStart')?.value;
  const endDate = document.getElementById('leaveEnd')?.value;
  const notes = document.getElementById('leaveNotes')?.value?.trim();
  
  if (!reason || !startDate || !endDate) {
    showToast('⚠️ يرجى ملء جميع الحقول المطلوبة', 'error');
    return;
  }
  
  AppState.leaveRequests.push({
    id: Date.now(),
    studentCode: student.code,
    studentName: student.name,
    parentName: AppState.parentName,
    reason,
    startDate,
    endDate,
    notes,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  
  saveToCloud();
  showToast('✅ تم إرسال طلب الإجازة بنجاح');
  navigateToPage('p-leave-request');
}

// ============================================================
// 💬 PARENT: CHAT WITH TEACHER (NEW FEATURE #14)
// ============================================================
function renderParentChat() {
  const student = AppState.students[AppState.parentStudentIndex];
  if (!student) return '<div class="card"><p>لم يتم اختيار طالب</p></div>';
  
  const messages = AppState.chatMessages.filter(m => 
    m.studentCode === student.code || m.to === AppState.parentName
  );
  
  const messagesHTML = messages.map(msg => `
    <div class="chat-message ${msg.from === 'parent' ? 'sent' : 'received'}">
      <div>${escapeHTML(msg.text)}</div>
      <div class="chat-time">${msg.time || ''}</div>
    </div>
  `).join('');
  
  return `
    ${renderStudentSelector()}
    
    <div class="card">
      <div class="section-title">💬 محادثة مع المدرس — ${escapeHTML(student.name)}</div>
      
      <div class="chat-container" id="chatContainer">
        ${messagesHTML || '<div style="text-align: center; opacity: 0.4; padding: 20px;">لا توجد رسالات بعد. ابدأ المحادثة!</div>'}
      </div>
      
      <div class="chat-input-wrap">
        <input class="chat-input" id="chatMessageInput" placeholder="اكتب رسالتك هنا..." onkeypress="if(event.key==='Enter')sendChatMessage()"/>
        <button class="chat-send-btn" onclick="sendChatMessage()">➤</button>
      </div>
    </div>
  `;
}

function sendChatMessage() {
  const input = document.getElementById('chatMessageInput');
  const text = input?.value?.trim();
  const student = AppState.students[AppState.parentStudentIndex];
  
  if (!text || !student) return;
  
  AppState.chatMessages.push({
    id: Date.now(),
    studentCode: student.code,
    from: 'parent',
    fromName: AppState.parentName,
    to: 'teacher',
    text,
    time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
    read: false
  });
  
  input.value = '';
  saveToCloud();
  navigateToPage('p-chat');
  showToast('✅ تم إرسال رسالة');
}

// ============================================================
// ⚙️ PARENT SETTINGS
// ============================================================
function renderParentSettings() {
  return `
    <div class="card">
      <div class="section-title">👨‍👩‍👧 إعدادات ولي الأمر</div>
      
      <div class="form-group">
        <label class="form-label">اسم ولي الأمر</label>
        <input class="form-input" id="settingsParentName" value="${escapeHTML(AppState.parentName)}"/>
      </div>
      
      <div class="form-group">
        <label class="form-label">رقم الهاتف (لللإشعارات)</label>
        <input class="form-input" id="settingsPhone" placeholder="07XXXXXXXX" type="tel"/>
      </div>
      
      <button class="btn-success" onclick="saveParentSettings()">💾 حفظ الإعدادات</button>
    </div>
    
    <div class="card">
      <div class="section-title">🔔 إشعارات</div>
      
      <label style="display: flex; align-items: center; gap: 10px; padding: 12px 0; cursor: pointer;" onclick="toggleNotifGrades()">
        <input type="checkbox" id="notifGrades" checked style="width: 18px; height: 18px; accent-color: var(--accent);"/>
        <span>إشعار عند حفظ درجات جديدة</span>
      </label>
      
      <label style="display: flex; align-items: center; gap: 10px; padding: 12px 0; cursor: pointer;" onclick="toggleNotifAttendance()">
        <input type="checkbox" id="notifAttendance" checked style="width: 18px; height: 18px; accent-color: var(--accent);"/>
        <span>إشعار عند تسجيل غياب</span>
      </label>
      
      <label style="display: flex; align-items: center; gap: 10px; padding: 12px 0; cursor: pointer;" onclick="toggleNotifHomework()">
        <input type="checkbox" id="notifHomework" checked style="width: 18px; height: 18px; accent-color: var(--accent);"/>
        <span>إشعار عند إضافة واجب جديد</span>
      </label>
    </div>
    
    <div class="card">
      <div class="section-title">🌐 اللغة</div>
      <button class="btn-action" onclick="toggleLanguage()">English / العربية</button>
    </div>
  `;
}

function saveParentSettings() {
  AppState.parentName = document.getElementById('settingsParentName')?.value?.trim() || AppState.parentName;
  
  if (AppState.role === 'parent') {
    document.getElementById('sidebarUserName').textContent = AppState.parentName;
    document.getElementById('sidebarAvatar').textContent = AppState.parentName.charAt(0) || '?';
    document.getElementById('headerAvatar').textContent = AppState.parentName.charAt(0) || '?';
  }
  
  showToast('✅ تم حفظ الإعدادات');
}

function toggleNotifGrades() {
  const checkbox = document.getElementById('notifGrades');
  if (checkbox) checkbox.checked = !checkbox.checked;
}
function toggleNotifAttendance() {
  const checkbox = document.getElementById('notifAttendance');
  if (checkbox) checkbox.checked = !checkbox.checked;
}
function toggleNotifHomework() {
  const checkbox = document.getElementById('notifHomework');
  if (checkbox) checkbox.checked = !checkbox.checked;
}

function toggleLanguage() {
  // Language toggle logic here
  const currentLang = localStorage.getItem('lang') || 'ar';
  const newLang = currentLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('lang', newLang);
  document.documentElement.lang = newLang;
  document.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  showToast(`تم التبديل إلى ${newLang === 'ar' ? 'العربية' : 'English'}`);
}

// ============================================================
// 📊 TEACHER: DASHBOARD (NEW FEATURE)
// ============================================================
function renderTeacherDashboard() {
  const todayAttendance = AppState.todayAttendance || [];
  const presentToday = todayAttendance.filter(s => s === 'حاضر').length;
  const absentToday = todayAttendance.filter(s => s === 'غائب').length;
  
  return `
    <div class="card" style="background: linear-gradient(135deg, rgba(204,120,92,0.15), rgba(212,149,106,0.1)); border-color: var(--accent);">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">👋</div>
        <div>
          <h2 style="font-size: 22px; font-weight: 900; margin-bottom: 4px;">مرحباً، ${escapeHTML(AppState.teacherName || 'المدرس')}</h2>
          <p style="opacity: 0.6; font-size: 14px;">${new Date().toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
    
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-icon">👦</div>
        <div class="stat-value" style="color: #e8a87c;">${AppState.students.length}</div>
        <div class="stat-label">طلاب الفصل</div>
      </div>
      <div class="stat">
        <div class="stat-icon">📚</div>
        <div class="stat-value" style="color: #f59e0b;">${Object.keys(AppState.gradesDB).length}</div>
        <div class="stat-label">المواد</div>
      </div>
      <div class="stat">
        <div class="stat-icon">✅</div>
        <div class="stat-value" style="color: #22c55e;">${presentToday}</div>
        <div class="stat-label">حاضر اليوم</div>
      </div>
      <div class="stat">
        <div class="stat-icon">❌</div>
        <div class="stat-value" style="color: #ef4444;">${absentToday}</div>
        <div class="stat-label">غائب اليوم</div>
      </div>
      <div class="stat">
        <div class="stat-icon">📝</div>
        <div class="stat-value" style="color: #38bdf8;">${AppState.announcements.length}</div>
        <div class="stat-label">إعلانات</div>
      </div>
      <div class="stat">
        <div class="stat-icon">📋</div>
        <div class="stat-value" style="color: #a78bfa;">${AppState.homework.length}</div>
        <div class="stat-label">واجبات</div>
      </div>
    </div>
    
    <div class="card">
      <div class="section-title">⚡ إجراءات سريعة</div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        <button class="export-btn" onclick="navigateToPage('t-attendance')" style="justify-content: center; padding: 14px;">
          📅 تسجيل الحضور
        </button>
        <button class="export-btn" onclick="navigateToPage('t-grades')" style="justify-content: center; padding: 14px;">
          📝 إدخالدرجات
        </button>
        <button class="export-btn" onclick="navigateToPage('t-announce')" style="justify-content: center; padding: 14px;">
          📢 إعلان جديد
        </button>
        <button class="export-btn" onclick="navigateToPage('t-homework')" style="justify-content: center; padding: 14px;">
          📚 إضافة واجب
        </button>
      </div>
      
      <div class="card">
        <div class="section-title">🔔 آخر النشاطات</div>
        ${renderRecentActivity()}
      </div>
  `;
}

function renderRecentActivity() {
  const activities = [];
  
  // Add recent announcements
  AppState.announcements.slice(0, 2).forEach(a => {
    activities.push({ icon: '📢', text: `إعلان: ${a.title}`, time: a.date });
  });
  
  // Add recent homework
  AppState.homework.slice(0, 2).forEach(h => {
    activities.push({ icon: '📚', text: `واجب: ${h.subject}`, time: h.due });
  });
  
  if (activities.length === 0) {
    return '<div style="opacity: 0.4; text-align: center; padding: 16px;">لا توجد نشاطات حديثة</div>';
  }
  
  return activities.map(a => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
      <span style="font-size: 20px;">${a.icon}</span>
      <div style="flex: 1;">
        <div style="font-size: 14px; font-weight: 600;">${escapeHTML(a.text)}</div>
        <div style="font-size: 11px; opacity: 0.5;">${a.time || ''}</div>
      </div>
  `).join('');
}

// ============================================================
// 📝 TEACHER: GRADES ENTRY
// ============================================================
let activeRoundTab = 1;

function renderTeacherGrades() {
  const subjectList = Object.keys(AppState.gradesDB);
  
  if (!subjectList.length) {
    return `
      <div class="card" style="text-align: center; padding: 36px; opacity: 0.6;">
        <p style="font-size: 48px; margin-bottom: 16px;">📭</p>
        <p style="font-weight: 600; margin-bottom: 8px;">لا توجد مواد</p>
        <p style="font-size: 13px; opacity: 0.6;">اذهب إلى ⚙️ الإعدادات وأضف المواد أولاً</p>
      </div>
    `;
  }
  
  const subjectOptions = subjectList.map(s => 
    `<option value="${escapeHTML(s)}">${escapeHTML(s)}${AppState.teachers[s] ? ' — ' + escapeHTML(AppState.teachers[s]) : ''}</option>`
  ).join('');
  
  return `
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-icon">👦</div>
        <div class="stat-value" style="color: #e8a87c;">${AppState.students.length}</div>
        <div class="stat-label">طلاب</div>
      </div>
      <div class="stat">
        <div class="stat-icon">📚</div>
        <div class="stat-value" style="color: #f59e0b;">${subjectList.length}</div>
        <div class="stat-label">مواد</div>
      </div>
      <div class="stat">
        <div class="stat-icon">📊</div>
        <div class="stat-value">A</div>
        <div class="stat-label">تقدير</div>
      </div>
    </div>
    
    <div class="card">
      <div class="section-title">📝 إدخالدرجات</div>
      
      <div class="form-group">
        <label class="form-label">اختر المادة</label>
        <select class="form-select" id="gradeSubjectSelect" onchange="onSubjectSelected()">
          <option value="">-- اختر المادة --</option>
          ${subjectOptions}
        </select>
      </div>
      
      <div id="subjectLockArea"></div>
      
      <div id="gradesEntryArea" style="display: none;">
        <div style="display: flex; gap: 10px; margin-bottom: 18px;">
          <button id="round1Tab" onclick="switchRound(1)" class="btn-active-round" style="
            padding: 12px; border-radius: 8px; border: 2px solid #34d399; background: rgba(52,211,153,0.15); color: #34d399; font-weight: 800; cursor: pointer;"
          ">📘 الدور الأول
          </button>
          <button id="round2Tab" onclick="switchRound(2)" style="
            padding: 12px; border-radius: 8px; border: 2px solid var(--border-color); background: transparent; color: var(--text-muted); font-weight: 800; cursor: pointer;"
          ">📗 الدور الثاني
          </button>
        </div>
        
        <div id="round1Content">
          <div style="background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; font-size: 13px; color: #34d399; font-weight: 600;">
            📘 الدور الأول — اليومي + شهري (3 امتحانات) + نصف السنة + المعدل النهائي
          </div>
          ${renderGradeInputsForStudents('r1')}
        </div>
        
        <div id="round2Content" style="display: none;">
          <div style="background: rgba(244,114,182,0.08); border: 1px solid rgba(244,114,182,0.25); border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; font-size: 13px; color: #f472b6; font-weight: 600;">
            📗 الدور الثاني — اليومي + شهري (3 امتحانات) + آخر السنة + المعدل النهائي
          </div>
          ${renderGradeInputsForStudents('r2')}
        </div>
        
        <button class="btn-success" onclick="saveGradesToCloud()">💾 حفظ الدرجات</button>
      </div>
    </div>
  `;
}

function createScoreInput(label, color, id, idx, round) {
  return `
    <div style="text-align: center;">
      <div style="font-size: 10px; color: ${color}; margin-bottom: 4px; font-weight: 700;">${label}</div>
      <input class="score-input" id="${id}" type="number" min="0" max="100" placeholder="--"
             oninput="previewGrade('${round}', ${idx})" style="width: 100%; font-size: 13px; padding: 5px 4px;"/>
    </div>
  `;
}

function onSubjectSelected() {
  const subject = document.getElementById('gradeSubjectSelect')?.value;
  const lockArea = document.getElementById('subjectLockArea');
  const entryArea = document.getElementById('gradesEntryArea');
  
  if (!subject) {
    lockArea.innerHTML = '';
    entryArea.style.display = 'none';
    return;
  }
  
  if (AppState.unlockedSubjects[subject]) {
    lockArea.innerHTML = `
      <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
        ✅ <span style="color: #22c55e; font-weight: 600;">مادة <strong>${escapeHTML(subject)}</strong> مفتوحة للتعديل</span>
      </div>
    `;
    entryArea.style.display = 'block';
    loadExistingGrades(subject);
  } else {
    entryArea.style.display = 'none';
    lockArea.innerHTML = `
      <div style="background: var(--bg-tertiary); border: 2px solid rgba(14,165,233,0.3); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
        <div style="font-size: 36px; margin-bottom: 10px;">🔐</div>
        <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">${escapeHTML(subject)}</div>
        <div style="font-size: 13px; opacity: 0.5; margin-bottom: 18px;">أدخل الكود السري لهذه المادة</div>
        <input id="subjectCodeInput" type="number" maxlength="4"
               style="width: 160px; padding: 14px; border-radius: 8px; border: 2px solid rgba(14,165,233,0.3); background: var(--bg-secondary); color: #38bdf8; font-size: 26px; font-weight: 800; text-align: center; outline: none; letter-spacing: 6px; direction: ltr;"
               placeholder="----" oninput="this.value=this.value.slice(0,4)"/>
        <div id="subjectCodeError" class="error-msg" style="margin-top: 10px;">❌ الكود غير صحيح!</div>
        <button onclick="unlockSubject('${escapeHTML(subject)}')" style="
          display: inline-block; width: 100%; margin-top: 12px; padding: 14px; border: none; background: linear-gradient(135deg, #0ea5e9, #06b6d4); color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; font-family: inherit;"
        ">دخول ←
      </div>
    `;
  }
}

function unlockSubject(subject) {
  const entered = document.getElementById('subjectCodeInput')?.value?.trim();
  const correct = AppState.subjectCodes[subject];
  
  if (!correct || entered === correct) {
    AppState.unlockedSubjects[subject] = true;
    onSubjectSelected();
    showToast(`✅ تم فتح مادة ${subject}`);
  } else {
    const err = document.getElementById('subjectCodeError');
    if (err) {
      err.classList.add('show');
      setTimeout(() => err.classList.remove('show'), 2500);
    }
    const inp = document.getElementById('subjectCodeInput');
    if (inp) {
      inp.style.borderColor = 'var(--danger)';
      setTimeout(() => inp.style.borderColor = 'rgba(14,165,233,0.3)', 1500);
    }
  }
}

function switchRound(round) {
  activeRoundTab = round;
  
  document.getElementById('round1Content').style.display = round === 1 ? 'block' : 'none';
  document.getElementById('round2Content').style.display = round === 2 ? 'block' : 'none';
  
  const t1 = document.getElementById('round1Tab');
  const t2 = document.getElementById('round2Tab');
  
  [t1, t2].forEach(btn => {
    btn.style.border = `2px solid ${round === 1 ? '#34d399' : 'var(--border-color)'}`;
    btn.style.background = `${round === 1 ? 'rgba(52,211,153,0.15)' : 'transparent'}`;
    btn.style.color = `${round === 1 ? '#34d399' : 'var(--text-muted)'}`;
  });
  
  const activeBtn = round === 1 ? t1 : t2;
  const color = round === 1 ? '#34d399' : '#f472b6';
  activeBtn.style.border = `2px solid ${color}`;
  activeBtn.style.background = `${color}22`;
  activeBtn.style.color = color;
}

function previewGrade(round, studentIdx) {
  const finalValue = parseFloat(document.getElementById(`${round}_final_${studentIdx}`)?.value) || 0;
  const previewEl = document.getElementById(`preview_${round}_${studentIdx}`);
  
  if (previewEl) {
    if (finalValue > 0) {
      previewEl.innerHTML = `<span style="color: ${getGradeColor(finalValue)}; font-weight: 800;">المعدل: ${finalValue} — ${getGradeLabel(finalValue)}</span>`;
    } else {
      previewEl.innerHTML = '';
    }
  }
}

function loadExistingGrades(subject) {
  AppState.students.forEach((_, idx) => {
    const gradeData = AppState.gradesDB[subject]?.[idx] || {};
    const r1 = gradeData.r1 || {};
    const r2 = gradeData.r2 || {};
    
    const setValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val > 0 ? val : '';
    };
    
    setValue(`r1_daily_${idx}`, r1.daily);
    setValue(`r1_m1_${idx}`, r1.m1);
    setValue(`r1_m2_${idx}`, r1.m2);
    setValue(`r1_m3_${idx}`, r1.m3);
    setValue(`r1_mid_${idx}`, r1.midYear);
    setValue(`r1_final_${idx}`, r1.final);
    
    setValue(`r2_daily_${idx}`, r2.daily);
    setValue(`r2_m1_${idx}`, r2.m1);
    setValue(`r2_m2_${idx}`, r2.m2);
    setValue(`r2_m3_${idx}`, r2.m3);
    setValue(`r2_finalYr_${idx}`, r2.finalYear);
    setValue(`r2_final_${idx}`, r2.final);
    
    previewGrade('r1', idx);
    previewGrade('r2', idx);
  });
}

function saveGradesToCloud() {
  const subject = document.getElementById('gradeSubjectSelect')?.value;
  if (!subject) {
    showToast('⚠️ اختر المادة أولاً', 'error');
    return;
  }
  
  if (!AppState.gradesDB[subject]) AppState.gradesDB[subject] = [];
  
  AppState.students.forEach((_, idx) => {
    const getValue = id => clampValue(parseInt(document.getElementById(id)?.value) || 0);
    const prev = AppState.gradesDB[subject][idx] || {};
    
    AppState.gradesDB[subject][idx] = {
      r1: {
        daily: getValue(`r1_daily_${idx}`) || prev.r1?.daily || 0,
        m1: getValue(`r1_m1_${idx}`) || prev.r1?.m1 || 0,
        m2: getValue(`r2_m2_${idx}`) || prev.r2?.m2 || 0,
        m3: getValue(`r1_m3_${idx}`) || prev.r1?.m3 || 0,
        midYear: getValue(`r1_mid_${idx}`) || prev.r1?.midYear || 0,
        final: getValue(`r1_final_${idx}`) || prev.r1?.final || 0,
      },
      r2: {
        daily: getValue(`r2_daily_${idx}`) || prev.r2?.daily || 0,
        m1: getValue(`r2_m1_${idx}`) || prev.r2?.m1 || 0,
        m2: getValue(`r2_m2_${idx}`) || prev.r2?.m2 || 0,
        m3: getValue(`r2_m3_${idx}`) || prev.r2?.m3 || 0,
        finalYear: getValue(`r2_finalYr_${idx}`) || prev.r2?.finalYear || 0,
        final: getValue(`r2_final_${idx}`) || prev.r2?.final || 0
      }
    };
  });
  
  // Add notification for parents (Feature #11)
  addNotification({
    type: 'grades_updated',
    subject,
    timestamp: new Date().toISOString()
  });
  
  saveToCloud();
  showToast(`✅ تم حفظ درجات ${subject}`);
}

// ============================================================
// 📅 TEACHER ATTENDANCE
// ============================================================
function renderTeacherAttendance() {
  const today = getTodayDateString();
  const todayRecord = AppState.attendanceDB.find(a => a.date === today);
  
  if (todayRecord) {
    AppState.todayAttendance = [...todayRecord.statuses];
  } else if (AppState.todayAttendance.length !== AppState.students.length) {
    AppState.todayAttendance = AppState.students.map((_, i) => AppState.todayAttendance[i] || 'حاضر');
  }
  
  const rows = AppState.students.map((student, idx) => {
    const status = AppState.todayAttendance[idx] || 'حاضر';
    
    return `
      <div class="attend-row">
        <div class="user-avatar" style="width: 38px;height:38px;font-size:15px;">${student.name.charAt(0)}</div>
        <div class="attend-name">${student.name}</div>
        <div class="status-btns">
          <button class="status-btn ${status === 'حاضر' ? 'on' : ''}" onclick="setAt(${idx},'حاضر',this)">حاضر</button>
          <button class="status-btn ${status === 'غائب' ? 'on' : ''}" onclick="setAt(${idx},'غائب',this)">غائب</button>
          <button class="status-btn ${status === 'متأخر' ? 'on' : ''}" onclick="setAt(${idx},'متأخر',this)">متأخر</button>
        </div>
      </div>
    `;
  });

function setAt(i, st, btn) {
  AppState.todayAttendance[i] = st;
  const row = btn.closest('.attend-row');
  row.querySelectorAll('.status-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  
  const p = document.getElementById('presentCount');
  const a = document.getElementById('absentCount');
  const l = document.getElementById('lateCount');
  
  if (p) p.textContent = AppState.todayAttendance.filter(x => x === 'حاضر').length;
  if (a) a.textContent = AppState.todayAttendance.filter(x => x === 'غائب').length;
  if (l) l.textContent = AppState.todayAttendance.filter(x => x === 'متأخر').length;
  
  navigateToPage('t-attend');
}

function saveAttendance() {
  const today = getTodayDateString();
  const ex = AppState.attendanceDB.find(a => a.date === today);
  
  if (ex) ex.statuses = [...AppState.todayAttendance];
  else AppState.attendanceDB.unshift({date: today, statuses: [...AppState.todayAttendance]});
  
  // Notify for absent students (#6)
  AppState.todayAttendance.forEach((st, i) => {
    if (st === 'غائب') {
      AppState.notifications.push({
        type: 'absent',
        student: AppState.students[i].name,
        time: new Date().toISOString()
      });
    }
  });
  
  saveToCloud();
  showToast('✅ تم حفظ الحضور');
}

// ============================================================
// 📆 SCHEDULE EDITOR (NEW #3)
// ============================================================
function renderScheduleEditor() {
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  const periods = ['٧:٠٠٠', '٨:٨:٠٠', '١٠:١٠', '١١:١١:١٢:١٢:١٢'];
  
  return `
    <div class="card">
      <div class="section-title">📆 جدول الحصص الأسبوعي</div>
      
      <button class="btn-action" style="background: var(--blue); color:#fff;width:auto;display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;" onclick="addPeriod()">
        ➕ إضافة حصة جديدة
      </button>
      
      <div style="overflow-x:auto;">
        <table class="schedule-grid">
          <thead>
            <tr>
              <th class="schedule-header">#</th>
              ${days.map(d => `<th>${d}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${periods.map((p, pi) => `
              <tr>
                <td class="schedule-header">${p}</td>
                ${days.map((_, di) => `
                  <td class="schedule-cell ${AppState.schedule.find(s => s.p===pi && s.d===di)?'has-class':''}">
                    ${AppState.schedule.find(s => s.p===pi && s.d===di)?.subject || ''}
                  </td>
                ` ).join('')}
              </tr>
            ` ).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
} 
