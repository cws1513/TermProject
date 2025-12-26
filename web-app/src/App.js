import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { FaTrash, FaPlus, FaSignOutAlt, FaGoogle, FaSearch, FaCheck, FaRegCalendarAlt, FaClock, FaMapMarkerAlt, FaUserFriends, FaBell, FaRedo, FaPaperclip, FaList, FaThLarge } from 'react-icons/fa';
import './App.css';

const firebaseConfig = {
    apiKey: "AIzaSyCSP00TRTD7LropAr18KVQzBqwCqDv69lo",
    authDomain: "todo-calendar-app-dc2d8.firebaseapp.com",
    projectId: "todo-calendar-app-dc2d8",
    storageBucket: "todo-calendar-app-dc2d8.firebasestorage.app",
    messagingSenderId: "377490408598",
    appId: "1:377490408598:web:82376d0eeae5ce25f12eb7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const formatYMD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Toast = ({ msg }) => (
    <div className={`toast-message ${msg ? 'show' : ''}`}>{msg}</div>
);

function App() {
    const [user, setUser] = useState(null);
    const [todos, setTodos] = useState([]);
    const [allTodos, setAllTodos] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState('');

    const [title, setTitle] = useState('');
    const [memo, setMemo] = useState('');
    const [location, setLocation] = useState('');
    const [attendees, setAttendees] = useState('');
    const [priority, setPriority] = useState(1);
    const [category, setCategory] = useState('업무');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [repeat, setRepeat] = useState('없음');
    const [notification, setNotification] = useState('10분 전');
    const [attachment, setAttachment] = useState(null);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [editId, setEditId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [viewMode, setViewMode] = useState('월간');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        setTodos([]);
        const dateStr = formatYMD(selectedDate);
        const q = query(collection(db, "users", user.uid, "todos"), where("date", "==", dateStr), orderBy("startTime", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newTodos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTodos(newTodos);
        });
        return () => unsubscribe();
    }, [user, selectedDate]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "users", user.uid, "todos"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => doc.data().date);
            setAllTodos(list);
        });
        return () => unsubscribe();
    }, [user]);

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        try {
            if (isLoginMode) await signInWithEmailAndPassword(auth, email, password);
            else { await createUserWithEmailAndPassword(auth, email, password); showToast("회원가입 완료! 자동 로그인됩니다."); }
        } catch (err) { alert("오류: " + err.message); }
    };

    const handleGoogleLogin = async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert("오류: " + e.message); }
    };

    const handleSave = async () => {
        if (!title.trim()) return alert("제목을 입력해주세요.");
        const dateStr = formatYMD(selectedDate);
        const tempId = 'temp-' + Date.now();

        const newTodoData = {
            id: editId || tempId,
            title, memo, date: dateStr, startTime, endTime, isDone: false, priority, category,
            location, attendees, repeat, notification, attachment,
            createdAt: new Date()
        };

        closeModal();

        try {
            if (editId) {
                setTodos(prev => prev.map(t => t.id === editId ? { ...t, ...newTodoData } : t));
                showToast("수정되었습니다.");
                if (!editId.toString().startsWith('temp-')) {
                    await updateDoc(doc(db, "users", user.uid, "todos", editId), {
                        title, memo, startTime, endTime, priority, category,
                        location, attendees, repeat, notification, attachment
                    });
                }
            } else {
                setTodos(prev => [...prev, newTodoData].sort((a,b) => a.startTime.localeCompare(b.startTime)));
                showToast("일정이 등록되었습니다.");

                const docRef = await addDoc(collection(db, "users", user.uid, "todos"), {
                    title, memo, date: dateStr, startTime, endTime, isDone: false, priority, category,
                    location, attendees, repeat, notification, attachment,
                    createdAt: serverTimestamp()
                });

                setTodos(prev => prev.map(t => t.id === tempId ? { ...t, id: docRef.id } : t));
            }
        } catch (e) { console.error(e); }
    };

    const openEditModal = (todo) => {
        setEditId(todo.id); setTitle(todo.title); setMemo(todo.memo || '');
        setStartTime(todo.startTime); setEndTime(todo.endTime || todo.startTime);
        setPriority(todo.priority); setCategory(todo.category);
        setLocation(todo.location || ''); setAttendees(todo.attendees || '');
        setRepeat(todo.repeat || '없음'); setNotification(todo.notification || '10분 전');
        setAttachment(todo.attachment || null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false); setEditId(null); setTitle(''); setMemo(''); setStartTime('09:00'); setEndTime('10:00');
        setLocation(''); setAttendees(''); setRepeat('없음'); setNotification('10분 전'); setAttachment(null);
    };

    const toggleDone = async (e, item) => {
        e.stopPropagation();
        if (!user) return;
        setTodos(prev => prev.map(t => t.id === item.id ? { ...t, isDone: !t.isDone } : t));
        if (item.id.toString().startsWith('temp-')) return;
        try { await updateDoc(doc(db, "users", user.uid, "todos", item.id), { isDone: !item.isDone }); } catch(e){}
    };

    const deleteTodo = async (e, id) => {
        e.stopPropagation();
        if(!window.confirm("정말 삭제하시겠습니까?")) return;
        setTodos(prev => prev.filter(t => t.id !== id));
        showToast("삭제되었습니다.");
        if (id.toString().startsWith('temp-')) return;
        try { await deleteDoc(doc(db, "users", user.uid, "todos", id)); } catch(e){}
    };

    const tileContent = ({ date, view }) => {
        if (view === 'month') {
            const dateStr = formatYMD(date);
            if (allTodos.includes(dateStr)) return <div className="dot-marker"></div>;
        }
    };

    const getCategoryColor = (cat) => {
        switch(cat) {
            case '업무': return '#4A90E2'; case '공부': return '#F5A623'; case '운동': return '#7ED321'; default: return '#9013FE';
        }
    };

    const filteredTodos = todos.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

    // ★ [핵심] 로그인 화면 (3D Flip 적용)
    if (!user) {
        return (
            <div className="auth-container">
                <div className={`flip-card ${!isLoginMode ? 'flipped' : ''}`}>
                    <div className="flip-card-inner">
                        {/* 앞면: 로그인 */}
                        <div className="auth-card-face auth-front">
                            <h1>📅 Todo Master</h1>
                            <p>스마트한 일정 관리의 시작</p>
                            <form onSubmit={handleAuth}>
                                <input type="email" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} required />
                                <input type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} required />
                                <button type="submit" className="primary-btn">로그인</button>
                            </form>
                            <button className="google-btn" onClick={handleGoogleLogin}><FaGoogle/> Google로 시작</button>
                            <p className="toggle-link" onClick={() => {setIsLoginMode(false); setEmail(''); setPassword('');}}>계정이 없으신가요? 회원가입</p>
                        </div>

                        {/* 뒷면: 회원가입 */}
                        <div className="auth-card-face auth-back">
                            <h1>✨ 회원가입</h1>
                            <p>새로운 여정을 시작하세요</p>
                            <form onSubmit={handleAuth}>
                                <input type="email" placeholder="이메일 (아이디)" value={email} onChange={e=>setEmail(e.target.value)} required />
                                <input type="password" placeholder="비밀번호 (6자리 이상)" value={password} onChange={e=>setPassword(e.target.value)} required />
                                <button type="submit" className="primary-btn" style={{background:'#764ba2'}}>가입하기</button>
                            </form>
                            <p className="toggle-link" onClick={() => {setIsLoginMode(true); setEmail(''); setPassword('');}}>이미 계정이 있으신가요? 로그인</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Toast msg={toastMsg} />
            <header className="app-header">
                <div className="logo-area"><h2>Todo Master Pro</h2><span className="user-badge">{user.email.split('@')[0]}</span></div>
                <div className="view-mode-tabs">{['일간', '주간', '월간', '목록'].map(m => (<button key={m} className={viewMode === m ? 'active' : ''} onClick={()=>setViewMode(m)}>{m}</button>))}</div>
                <button onClick={() => signOut(auth)} className="logout-btn"><FaSignOutAlt /> 로그아웃</button>
            </header>
            <div className="main-content">
                <div className="left-panel">
                    <Calendar onChange={setSelectedDate} value={selectedDate} formatDay={(l, d) => d.getDate()} tileContent={tileContent}/>
                    <div className="my-calendars">
                        <h4>내 캘린더</h4>
                        <div className="calendar-item"><span className="dot" style={{background:'#4A90E2'}}></span> 업무</div>
                        <div className="calendar-item"><span className="dot" style={{background:'#F5A623'}}></span> 공부</div>
                        <div className="calendar-item"><span className="dot" style={{background:'#7ED321'}}></span> 운동</div>
                        <div className="calendar-item"><span className="dot" style={{background:'#9013FE'}}></span> 기타</div>
                    </div>
                </div>
                <div className="right-panel">
                    <div className="list-header">
                        <div className="date-display"><h3>{selectedDate.toLocaleDateString()}</h3><span className="day-label">{['일','월','화','수','목','금','토'][selectedDate.getDay()]}요일</span></div>
                        <div className="header-actions">
                            <div className="search-box"><input type="text" placeholder="검색..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} /><FaSearch className="search-icon"/></div>
                            <button className="add-fab" onClick={() => setModalOpen(true)}><FaPlus /> 일정 추가</button>
                        </div>
                    </div>
                    <div className="todo-list">
                        {filteredTodos.length === 0 ? (
                            <div className="empty-state"><FaRegCalendarAlt size={40} color="#ddd"/><p>새로운 일정을 계획해보세요.</p></div>
                        ) : filteredTodos.map((todo) => (
                            <div key={todo.id} className={`todo-item ${todo.isDone ? 'done' : ''}`} onClick={() => openEditModal(todo)} style={{borderLeft: `5px solid ${getCategoryColor(todo.category)}`}}>
                                <div className="checkbox-area" onClick={(e) => toggleDone(e, todo)}><div className={`custom-checkbox ${todo.isDone ? 'checked' : ''}`}>{todo.isDone && <FaCheck size={10} color="white"/>}</div></div>
                                <div className="todo-content">
                                    <div className="todo-meta">
                                        <span className="time-badge"><FaClock size={10}/> {todo.startTime} ~ {todo.endTime}</span>
                                        <span className="category-tag" style={{color: getCategoryColor(todo.category), backgroundColor: getCategoryColor(todo.category)+'20'}}>{todo.category}</span>
                                        {todo.priority === 2 && <span className="urgent-tag">🔥 중요</span>}
                                        {todo.repeat !== '없음' && <span className="meta-icon"><FaRedo size={10}/></span>}
                                        {todo.attachment && <span className="meta-icon"><FaPaperclip size={10}/></span>}
                                    </div>
                                    <div className="todo-title">{todo.title}</div>
                                    <div className="todo-sub-info">
                                        {todo.location && <span><FaMapMarkerAlt size={10}/> {todo.location} &nbsp;</span>}
                                        {todo.attendees && <span><FaUserFriends size={10}/> {todo.attendees}</span>}
                                    </div>
                                    {todo.memo && <div className="todo-memo">{todo.memo}</div>}
                                </div>
                                <button className="delete-btn-mini" onClick={(e) => deleteTodo(e, todo.id)}><FaTrash /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {modalOpen && (
                <div className="modal-overlay" onClick={(e) => {if(e.target===e.currentTarget) closeModal()}}>
                    <div className="modal-content expanded">
                        <h3>{editId ? "일정 상세 수정" : "새 일정 만들기"}</h3>
                        <div className="modal-scroll-area">
                            <input type="text" className="input-title" placeholder="일정 제목을 입력하세요" value={title} onChange={(e)=>setTitle(e.target.value)} autoFocus />
                            <div className="section-title"><FaClock/> 일시 및 반복</div>
                            <div className="form-row row-2"><div className="time-inputs"><input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)}/><span>~</span><input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)}/></div><select value={repeat} onChange={e=>setRepeat(e.target.value)} className="select-box"><option>없음</option><option>매일</option><option>매주</option><option>매월</option><option>매년</option></select></div>
                            <div className="section-title"><FaMapMarkerAlt/> 장소 및 참석자</div>
                            <input type="text" className="input-line" placeholder="장소 추가" value={location} onChange={e=>setLocation(e.target.value)} />
                            <input type="text" className="input-line" placeholder="참석자 초대 (이메일 입력)" value={attendees} onChange={e=>setAttendees(e.target.value)} />
                            <div className="section-title"><FaThLarge/> 설정</div>
                            <div className="form-row row-2"><div className="category-select">{['업무', '공부', '운동', '기타'].map(cat => (<button key={cat} className={category===cat?'selected':''} onClick={()=>setCategory(cat)}>{cat}</button>))}</div><select value={notification} onChange={e=>setNotification(e.target.value)} className="select-box"><option>알림 없음</option><option>10분 전</option><option>30분 전</option><option>1시간 전</option><option>1일 전</option></select></div>
                            <div className="section-title"><FaList/> 메모 및 파일</div>
                            <textarea className="input-memo" placeholder="상세 내용을 입력하세요." value={memo} onChange={(e)=>setMemo(e.target.value)}></textarea>
                            <div className="file-upload-box" onClick={() => setAttachment("project_file.pdf")}><FaPaperclip/> {attachment ? attachment : "파일 첨부하기 (클릭)"}</div>
                            <div className="form-row" style={{marginTop:10}}><label>중요도</label><div className="priority-select">{[0, 1, 2].map(p => (<button key={p} className={priority===p?'selected':''} onClick={()=>setPriority(p)}>{p===2?"🔥 높음":p===1?"💧 보통":"☁️ 낮음"}</button>))}</div></div>
                        </div>
                        <div className="modal-actions"><button className="cancel" onClick={closeModal}>취소</button><button className="save" onClick={handleSave}>저장하기</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
export default App;