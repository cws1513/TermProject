import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, SafeAreaView, Modal, StatusBar, ActivityIndicator, Platform, UIManager, KeyboardAvoidingView, Animated, ScrollView } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, initializeAuth, getReactNativePersistence, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AntDesign, Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// 구글 로그인 팝업 처리를 위한 설정
WebBrowser.maybeCompleteAuthSession();

// 안드로이드 레이아웃 애니메이션 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// 캘린더 한국어 설정
LocaleConfig.locales['kr'] = { monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], monthNamesShort: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], dayNames: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'], dayNamesShort: ['일','월','화','수','목','금','토'], today: '오늘' };
LocaleConfig.defaultLocale = 'kr';

// --- 1. Firebase 설정 ---
const firebaseConfig = {
    apiKey: "AIzaSyCSP00TRTD7LropAr18KVQzBqwCqDv69lo",
    authDomain: "todo-calendar-app-dc2d8.firebaseapp.com",
    projectId: "todo-calendar-app-dc2d8",
    storageBucket: "todo-calendar-app-dc2d8.firebasestorage.app",
    messagingSenderId: "377490408598",
    appId: "1:377490408598:web:82376d0eeae5ce25f12eb7"
};

const app = initializeApp(firebaseConfig);

// Auth 지속성 관리 (앱을 껐다 켜도 로그인 유지)
let auth;
try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(ReactNativeAsyncStorage) });
} catch (e) {
    auth = getAuth(app);
}
const db = getFirestore(app);

// 날짜 포맷 함수
const formatYMD = (dateString) => {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
};

// 카테고리별 색상
const getCategoryColor = (cat) => {
    switch(cat) {
        case '업무': return '#4A90E2';
        case '공부': return '#F5A623';
        case '운동': return '#7ED321';
        default: return '#9013FE';
    }
};

// 토스트 메시지 컴포넌트
const Toast = ({ message, visible }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.delay(2000),
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })
            ]).start();
        }
    }, [visible]);
    if (!visible && fadeAnim._value === 0) return null;
    return (
        <Animated.View style={[styles.toastContainer, { opacity: fadeAnim }]}>
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
};

export default function App() {
    // --- 상태 관리 ---
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const [todos, setTodos] = useState([]);
    const [markedDates, setMarkedDates] = useState({});
    const [selectedDate, setSelectedDate] = useState(formatYMD(new Date()));
    const [modalVisible, setModalVisible] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [toastVisible, setToastVisible] = useState(false);

    // 입력 폼 상태
    const [title, setTitle] = useState('');
    const [memo, setMemo] = useState('');
    const [location, setLocation] = useState('');
    const [attendees, setAttendees] = useState('');
    const [repeat, setRepeat] = useState('없음');
    const [priority, setPriority] = useState(1);
    const [category, setCategory] = useState('업무');
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date());
    const [notification, setNotification] = useState('10분 전');
    const [attachment, setAttachment] = useState(null);

    // UI 상태
    const [timePickerMode, setTimePickerMode] = useState(null);
    const [editId, setEditId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // 애니메이션 값 (로그인 카드 뒤집기)
    const flipAnim = useRef(new Animated.Value(0)).current;
    const [isLoginMode, setIsLoginMode] = useState(true);

    // --- 2. Google 로그인 Hook ---
    const [request, response, promptAsync] = Google.useAuthRequest({
        expoClientId: 'YOUR_EXPO_CLIENT_ID', // 여기에 실제 클라이언트 ID가 필요할 수 있습니다.
        iosClientId: 'YOUR_IOS_CLIENT_ID',
        androidClientId: 'YOUR_ANDROID_CLIENT_ID',
        webClientId: '377490408598-3e191glg4spq104v4o0kc25ftt3ih190.apps.googleusercontent.com',
    });

    // ★ [추가됨] Access Token으로 유저 정보 직접 가져오기 (id_token 없을 때 대비)
    const fetchUserInfo = async (token) => {
        try {
            const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const userFromGoogle = await res.json();

            // Firebase Auth 객체 형식을 흉내내어 상태 업데이트
            setUser({
                uid: userFromGoogle.id, // 구글 ID를 UID로 사용
                email: userFromGoogle.email,
                displayName: userFromGoogle.name,
                photoURL: userFromGoogle.picture
            });
            showToast("구글 로그인 성공!");
        } catch (error) {
            console.error("User Info Error:", error);
            Alert.alert("로그인 실패", "사용자 정보를 가져오는데 실패했습니다.");
        }
    };

    // ★ [수정됨] 응답 처리 로직
    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token, access_token } = response.params;

            if (id_token) {
                // 1. id_token이 있으면 Firebase 정식 로그인 시도
                const credential = GoogleAuthProvider.credential(id_token);
                signInWithCredential(auth, credential)
                    .then(() => showToast("구글 로그인 성공!"))
                    .catch((error) => Alert.alert("로그인 실패", error.message));
            } else if (access_token) {
                // 2. id_token은 없지만 access_token이 있으면 직접 정보 조회
                console.log("id_token 없음. access_token으로 유저 정보 조회 시도...");
                fetchUserInfo(access_token);
            } else {
                console.log("토큰이 없습니다.");
            }
        }
    }, [response]);

    // --- Firebase Auth 리스너 ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            // 구글 로그인으로 수동 설정된 경우 덮어쓰지 않도록 주의
            if (u) {
                setUser(u);
            } else {
                // 로그아웃 상태일 때만 null 처리 (수동 로그인 유지를 위해)
                // 만약 Firebase 로그아웃을 명확히 할 때는 이 로직이 맞음
                // setUser(null);
            }
            if (initializing) setInitializing(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Firestore 데이터 불러오기 ---
    useEffect(() => {
        if (!user || !user.uid) return;
        setTodos([]);
        const q = query(collection(db, "users", user.uid, "todos"), where("date", "==", selectedDate), orderBy("startTime", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [user, selectedDate]);

    // --- 캘린더 점 찍기 ---
    useEffect(() => {
        if (!user || !user.uid) return;
        const q = query(collection(db, "users", user.uid, "todos"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const marks = {};
            snapshot.docs.forEach(doc => {
                const d = doc.data().date;
                if (d) marks[d] = { marked: true, dotColor: '#FF5E57' };
            });
            if (marks[selectedDate]) marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: '#4A90E2' };
            else marks[selectedDate] = { selected: true, selectedColor: '#4A90E2' };
            setMarkedDates(marks);
        });
        return () => unsubscribe();
    }, [user, selectedDate]);

    // --- 헬퍼 함수 ---
    const showToast = (msg) => {
        setToastMsg(msg);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2500);
    };

    // --- 로그인 화면 애니메이션 (Flip) ---
    const flipToSignup = () => {
        Animated.spring(flipAnim, { toValue: 180, friction: 8, tension: 10, useNativeDriver: true }).start();
        setIsLoginMode(false);
    };
    const flipToLogin = () => {
        Animated.spring(flipAnim, { toValue: 0, friction: 8, tension: 10, useNativeDriver: true }).start();
        setIsLoginMode(true);
    };

    // --- 로그인/회원가입 핸들러 ---
    const handleAuth = async () => {
        const cleanEmail = email.trim();
        const cleanPassword = password.trim();

        if (!cleanEmail || !cleanPassword) {
            Alert.alert("알림", "이메일과 비밀번호를 모두 입력해주세요.");
            return;
        }

        try {
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
            } else {
                if (cleanPassword.length < 6) {
                    Alert.alert("오류", "비밀번호는 최소 6자 이상이어야 합니다.");
                    return;
                }
                await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
                showToast("회원가입 완료! 자동 로그인됩니다.");
            }
        } catch (e) {
            console.error("Firebase Auth Error:", e);
            let msg = "로그인/회원가입 실패";
            if (e.code === 'auth/invalid-email') msg = "이메일 형식이 올바르지 않습니다.";
            if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
                msg = "이메일 또는 비밀번호가 일치하지 않습니다.";
            }
            if (e.code === 'auth/email-already-in-use') msg = "이미 사용 중인 이메일입니다.";
            if (e.code === 'auth/weak-password') msg = "비밀번호가 너무 약합니다 (6자 이상).";
            Alert.alert("오류", msg);
        }
    };

    const handleGoogleLogin = () => {
        promptAsync();
    };

    // --- 로그아웃 핸들러 ---
    const handleLogout = async () => {
        try {
            await signOut(auth); // Firebase 로그아웃
            setUser(null); // 강제 상태 초기화 (구글 로그인 사용자를 위해)
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) return Alert.alert("알림", "할 일을 입력해주세요.");

        const formatTime = (d) => {
            const target = d instanceof Date ? d : new Date();
            return target.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        };

        const startStr = typeof startTime === 'string' ? startTime : formatTime(startTime);
        const endStr = typeof endTime === 'string' ? endTime : formatTime(endTime);

        const tempId = 'temp-' + Date.now();
        const newTodoData = {
            id: editId || tempId, title, memo, date: selectedDate, startTime: startStr, endTime: endStr, isDone: false, priority, category,
            location, attendees, repeat, notification, attachment, createdAt: new Date()
        };

        closeModal();

        try {
            if (editId) {
                setTodos(prev => prev.map(t => t.id === editId ? { ...t, ...newTodoData } : t));
                showToast("일정이 수정되었습니다.");
                if(!editId.toString().startsWith('temp-')){
                    await updateDoc(doc(db, "users", user.uid, "todos", editId), {
                        title, memo, startTime: startStr, endTime: endStr, priority, category,
                        location, attendees, repeat, notification, attachment
                    });
                }
            } else {
                setTodos(prev => [...prev, newTodoData].sort((a,b) => a.startTime.localeCompare(b.startTime)));
                showToast("새 일정이 등록되었습니다.");
                const docRef = await addDoc(collection(db, "users", user.uid, "todos"), {
                    title, memo, date: selectedDate, startTime: startStr, endTime: endStr, isDone: false, priority, category,
                    location, attendees, repeat, notification, attachment, createdAt: serverTimestamp()
                });
                setTodos(prev => prev.map(t => t.id === tempId ? { ...t, id: docRef.id } : t));
            }
        } catch (e) { Alert.alert("에러", e.message); }
    };

    const openEditModal = (item) => {
        setEditId(item.id); setTitle(item.title); setMemo(item.memo || '');
        setLocation(item.location || ''); setAttendees(item.attendees || ''); setRepeat(item.repeat || '없음');
        setNotification(item.notification || '10분 전'); setAttachment(item.attachment || null);
        setPriority(item.priority); setCategory(item.category);
        setStartTime(new Date());
        setEndTime(new Date());
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false); setEditId(null); setTitle(''); setMemo('');
        setLocation(''); setAttendees(''); setRepeat('없음'); setNotification('10분 전'); setAttachment(null);
    };

    const toggleDone = async (item) => {
        setTodos(prev => prev.map(t => t.id === item.id ? { ...t, isDone: !t.isDone } : t));
        if (item.id.toString().startsWith('temp-')) return;
        try { await updateDoc(doc(db, "users", user.uid, "todos", item.id), { isDone: !item.isDone }); } catch(e){}
    };

    const deleteTodo = async (id) => {
        Alert.alert("삭제", "정말 삭제하시겠습니까?", [
            { text: "취소" },
            { text: "삭제", style: "destructive", onPress: async () => {
                    setTodos(prev => prev.filter(t => t.id !== id));
                    showToast("삭제되었습니다.");
                    if (id.toString().startsWith('temp-')) return;
                    try { await deleteDoc(doc(db, "users", user.uid, "todos", id)); } catch(e){}
                }}
        ]);
    };

    const onTimeChange = (event, selected) => {
        if (Platform.OS === 'android') setTimePickerMode(null);
        if (selected) {
            if (timePickerMode === 'start') setStartTime(selected);
            if (timePickerMode === 'end') setEndTime(selected);
        }
        if (Platform.OS === 'ios' && event.type === 'dismissed') setTimePickerMode(null);
    };

    // --- 렌더링 ---
    const total = todos.length;
    const doneCount = todos.filter(t => t.isDone).length;
    const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    const filteredTodos = todos.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

    const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] });
    const backInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] });
    const frontOpacity = flipAnim.interpolate({ inputRange: [89, 90], outputRange: [1, 0] });
    const backOpacity = flipAnim.interpolate({ inputRange: [89, 90], outputRange: [0, 1] });

    if (initializing) return <View style={styles.loadingCenter}><ActivityIndicator size="large" color="#4A90E2" /></View>;

    // ★ [로그인 화면] 3D Flip 적용
    if (!user) return (
        <LinearGradient colors={['#F5F7FA', '#c3cfe2']} style={styles.authContainer}>
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{width: '90%', alignItems: 'center', height: 600}}>
                {/* 앞면: 로그인 */}
                <Animated.View style={[styles.authCard, styles.flipCard, { transform: [{ rotateY: frontInterpolate }], opacity: frontOpacity }]}>
                    <View style={styles.authHeader}>
                        <Text style={styles.logoText}>📅 Todo Master</Text>
                        <Text style={styles.subtitleText}>스마트한 일정 관리의 시작</Text>
                    </View>
                    <TextInput style={styles.input} placeholder="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>
                    <TextInput style={styles.input} placeholder="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth}><Text style={styles.primaryBtnText}>로그인</Text></TouchableOpacity>

                    {/* ★ Google 로그인 버튼 */}
                    <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
                        <AntDesign name="google" size={20} color="#DB4437" style={{marginRight:10}}/>
                        <Text style={styles.googleBtnText}>Google 계정으로 로그인</Text>
                    </TouchableOpacity>

                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>계정이 없으신가요?</Text>
                        <TouchableOpacity onPress={flipToSignup}><Text style={styles.switchText}> 회원가입</Text></TouchableOpacity>
                    </View>
                </Animated.View>

                {/* 뒷면: 회원가입 */}
                <Animated.View style={[styles.authCard, styles.flipCard, styles.cardBack, { transform: [{ rotateY: backInterpolate }], opacity: backOpacity }]}>
                    <View style={styles.authHeader}>
                        <Text style={[styles.logoText, {color:'#764ba2'}]}>✨ 회원가입</Text>
                        <Text style={styles.subtitleText}>새로운 여정을 시작하세요</Text>
                    </View>
                    <TextInput style={styles.input} placeholder="이메일 (아이디)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>
                    <TextInput style={styles.input} placeholder="비밀번호 (6자리 이상)" value={password} onChangeText={setPassword} secureTextEntry />
                    <TouchableOpacity style={[styles.primaryBtn, {backgroundColor:'#764ba2'}]} onPress={handleAuth}><Text style={styles.primaryBtnText}>가입하기</Text></TouchableOpacity>
                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>이미 계정이 있으신가요?</Text>
                        <TouchableOpacity onPress={flipToLogin}><Text style={styles.switchText}> 로그인</Text></TouchableOpacity>
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
            <Toast message={toastMsg} visible={toastVisible} />
        </LinearGradient>
    );

    // ★ [메인 화면]
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Todo Master</Text>
                    <Text style={styles.headerSub}>{user.email ? user.email.split('@')[0] : "게스트"}님</Text>
                </View>
                {/* 로그아웃 버튼 수정 */}
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <MaterialIcons name="logout" size={18} color="#555" />
                    <Text style={styles.logoutText}>로그아웃</Text>
                </TouchableOpacity>
            </View>

            <Calendar
                current={selectedDate}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                monthFormat={'yyyy년 MM월'}
                markedDates={markedDates}
                theme={{ todayTextColor: '#4A90E2', arrowColor: '#4A90E2', textDayFontWeight: '600' }}
            />

            <View style={{paddingHorizontal:20, marginTop:15}}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8}}>
                    <Text style={{fontSize:13, fontWeight:'bold', color:'#555'}}>오늘의 달성률</Text>
                    <Text style={{fontSize:16, fontWeight:'bold', color:'#4A90E2'}}>{progress}%</Text>
                </View>
                <View style={{height:8, backgroundColor:'#eee', borderRadius:4, overflow:'hidden'}}>
                    <View style={{width:`${progress}%`, height:'100%', backgroundColor: progress===100?'#4CD964':'#4A90E2'}}/>
                </View>
            </View>

            <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="#aaa" style={{marginRight:10}} />
                <TextInput placeholder="일정 검색..." value={searchTerm} onChangeText={setSearchTerm} style={{flex:1}} />
            </View>

            <View style={styles.dateBar}>
                <Text style={styles.dateBarText}>{parseInt(selectedDate.split('-')[1])}월 {parseInt(selectedDate.split('-')[2])}일 ({filteredTodos.length})</Text>
            </View>

            <FlatList
                data={filteredTodos}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <FontAwesome5 name="calendar-alt" size={40} color="#ddd" />
                        <Text style={styles.emptyText}>새로운 일정을 계획해보세요.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={[styles.card, item.isDone && styles.cardDone, { borderLeftColor: getCategoryColor(item.category) }]}>
                        <TouchableOpacity onPress={() => toggleDone(item)} style={styles.checkArea} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <View style={[styles.customCheckbox, item.isDone && styles.checkedCheckbox]}>
                                {item.isDone && <Ionicons name="checkmark" size={14} color="white" />}
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.textArea} onPress={() => openEditModal(item)} activeOpacity={0.7}>
                            <View style={styles.metaRow}>
                                <View style={styles.timeBadge}><Ionicons name="time-outline" size={12} color="#666" style={{marginRight:2}} /><Text style={styles.timeText}>{item.startTime}</Text></View>
                                <Text style={[styles.categoryTag, {color: getCategoryColor(item.category), backgroundColor: getCategoryColor(item.category)+'20'}]}>{item.category}</Text>
                                {item.priority === 2 && <Text style={styles.urgentBadge}>🔥 중요</Text>}
                                {item.attachment && <FontAwesome5 name="paperclip" size={12} color="#888" style={{marginLeft:4}}/>}
                            </View>
                            <Text style={[styles.todoTitle, item.isDone && styles.textDone]}>{item.title}</Text>
                            <View style={{flexDirection:'row', gap:8, marginTop:2}}>
                                {item.location ? <Text style={styles.todoSub}><Ionicons name="location-outline" size={10}/> {item.location}</Text> : null}
                                {item.attendees ? <Text style={styles.todoSub}><Ionicons name="people-outline" size={10}/> {item.attendees}</Text> : null}
                            </View>
                            {item.memo ? <Text style={styles.todoMemo} numberOfLines={1}>{item.memo}</Text> : null}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteTodo(item.id)} style={styles.deleteBtn} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <Ionicons name="trash-outline" size={20} color="#ddd" />
                        </TouchableOpacity>
                    </View>
                )} />

            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>

            {/* 모달 (일정 추가/수정) */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editId ? "일정 상세 수정" : "새 일정 만들기"}</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <TextInput style={styles.modalInput} placeholder="일정 제목을 입력하세요" value={title} onChangeText={setTitle} autoFocus={!editId}/>

                            <Text style={styles.label}><Ionicons name="time-outline" size={14}/> 일시 및 반복</Text>
                            <View style={{flexDirection:'row', gap:5, marginBottom:10}}>
                                <TouchableOpacity style={styles.timeBtn} onPress={() => setTimePickerMode('start')}>
                                    <Text style={styles.timeBtnText}>
                                        {startTime instanceof Date ? startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : startTime}
                                    </Text>
                                </TouchableOpacity>
                                <Text style={{alignSelf:'center', color:'#888'}}>~</Text>
                                <TouchableOpacity style={styles.timeBtn} onPress={() => setTimePickerMode('end')}>
                                    <Text style={styles.timeBtnText}>
                                        {endTime instanceof Date ? endTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : endTime}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
                                {['없음','매일','매주','매월'].map(r => (
                                    <TouchableOpacity key={r} style={[styles.optionBtn, repeat===r&&styles.selectedBtn, {marginRight:5}]} onPress={()=>setRepeat(r)}>
                                        <Text style={[styles.optionText, repeat===r&&styles.selectedText]}>{r}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {timePickerMode && (
                                <DateTimePicker
                                    value={timePickerMode === 'start' ? (startTime instanceof Date ? startTime : new Date()) : (endTime instanceof Date ? endTime : new Date())}
                                    mode="time"
                                    display="default"
                                    onChange={onTimeChange}
                                />
                            )}
                            {Platform.OS === 'ios' && timePickerMode && (
                                <TouchableOpacity onPress={() => setTimePickerMode(null)} style={{alignItems:'center', padding:10}}>
                                    <Text style={{color:'#4A90E2', fontWeight:'bold'}}>완료</Text>
                                </TouchableOpacity>
                            )}

                            <Text style={styles.label}><Ionicons name="location-outline" size={14}/> 장소 및 참석자</Text>
                            <TextInput style={styles.modalInput} placeholder="장소 입력" value={location} onChangeText={setLocation} />
                            <TextInput style={styles.modalInput} placeholder="참석자 초대 (이메일)" value={attendees} onChangeText={setAttendees} />

                            <Text style={styles.label}><Ionicons name="document-text-outline" size={14}/> 메모 및 파일</Text>
                            <TextInput style={[styles.modalInput, {height:60, textAlignVertical:'top'}]} placeholder="상세 내용을 입력하세요." value={memo} onChangeText={setMemo} multiline={true} />
                            <TouchableOpacity style={styles.fileBtn} onPress={() => setAttachment("project_file.pdf")}>
                                <FontAwesome5 name="paperclip" size={14} color="#555"/>
                                <Text style={{marginLeft:5, color:'#555'}}>{attachment ? attachment : "파일 첨부하기 (클릭)"}</Text>
                            </TouchableOpacity>

                            <Text style={styles.label}><Ionicons name="settings-outline" size={14}/> 설정</Text>
                            <View style={styles.optionRow}>
                                {['업무', '공부', '운동', '기타'].map((cat) => (
                                    <TouchableOpacity key={cat} style={[styles.optionBtn, category === cat && styles.selectedBtn]} onPress={() => setCategory(cat)}>
                                        <Text style={[styles.optionText, category === cat && styles.selectedText]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={[styles.optionRow, {marginTop:8}]}>
                                {['알림 없음','10분 전','30분 전'].map(n => (
                                    <TouchableOpacity key={n} style={[styles.optionBtn, notification===n&&styles.selectedBtn]} onPress={() => setNotification(n)}>
                                        <Text style={[styles.optionText, notification===n&&styles.selectedText]}>{n}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={[styles.optionRow, {marginTop:8}]}>
                                {[0, 1, 2].map((p) => (
                                    <TouchableOpacity key={p} style={[styles.optionBtn, priority === p && styles.selectedBtn]} onPress={() => setPriority(p)}>
                                        <Text style={[styles.optionText, priority === p && styles.selectedText]}>{p===2?"🔥 높음":p===1?"💧 보통":"☁️ 낮음"}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={{height:20}}/>
                        </ScrollView>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                                <Text style={{color:'#666', fontWeight:'bold'}}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={{color:'white', fontWeight:'bold'}}>저장하기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Toast message={toastMsg} visible={toastVisible} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    authContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    flipCard: { position: 'absolute', top: 0, backfaceVisibility: 'hidden' },
    cardBack: { position: 'absolute', top: 0 },
    authCard: {
        width: '100%', backgroundColor: 'white', padding: 30, borderRadius: 20,
        alignItems: 'center', elevation: 10, shadowColor:'#000', shadowOpacity:0.1, shadowRadius:10,
        height: 550, justifyContent:'center'
    },
    authHeader: { alignItems: 'center', marginBottom: 30 },
    logoText: { fontSize: 26, fontWeight: '800', color: '#4A90E2', marginBottom: 5 },
    subtitleText: { color: '#888', fontSize: 14 },
    input: { width: '100%', backgroundColor: '#F5F7FA', padding: 15, borderRadius: 12, marginBottom: 12, fontSize: 16 },
    primaryBtn: { width: '100%', backgroundColor: '#4A90E2', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    googleBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        width: '100%', backgroundColor: 'white', padding: 15, borderRadius: 12,
        marginTop: 10, borderWidth: 1, borderColor: '#ddd'
    },
    googleBtnText: { color: '#555', fontWeight: 'bold', fontSize: 15 },
    footerContainer: { flexDirection: 'row', marginTop: 25 },
    footerText: { color: '#666' },
    switchText: { color: '#4A90E2', fontWeight: 'bold', marginLeft:5 },
    container: { flex: 1, backgroundColor: '#F8F9FB' },
    header: { padding: 20, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#333' },
    headerSub: { fontSize: 13, color: '#888', marginTop: 2, backgroundColor:'#f5f5f5', paddingVertical:2, paddingHorizontal:6, borderRadius:8, alignSelf:'flex-start' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 8, paddingHorizontal: 12, borderRadius: 20 },
    logoutText: { fontSize: 12, color: '#555', marginLeft: 4, fontWeight:'600' },
    dateBar: { paddingHorizontal: 20, marginTop:20, marginBottom:10 },
    dateBarText: { fontSize: 18, fontWeight: 'bold', color:'#333' },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    emptyContainer: { alignItems:'center', marginTop:50, gap:10 },
    emptyText: { textAlign: 'center', color: '#bbb', fontSize:15 },
    card: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        borderRadius: 16, marginBottom: 12, padding: 16, elevation: 2,
        shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, borderLeftWidth: 5
    },
    cardDone: { opacity: 0.6, backgroundColor: '#fcfcfc' },
    checkArea: { marginRight: 15 },
    customCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center', backgroundColor:'white' },
    checkedCheckbox: { backgroundColor: '#4CD964', borderColor: '#4CD964' },
    textArea: { flex: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
    timeBadge: { flexDirection:'row', alignItems:'center', backgroundColor:'#f5f5f5', paddingVertical:2, paddingHorizontal:6, borderRadius:4 },
    timeText: { fontSize: 11, fontWeight: 'bold', color: '#666' },
    categoryTag: { fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    urgentBadge: { fontSize: 10, color: '#FF5E57', fontWeight: 'bold', backgroundColor: '#FFE3E3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    todoTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
    todoSub: { fontSize: 11, color: '#888', marginTop: 2 },
    todoMemo: { fontSize: 12, color: '#999', marginTop: 4 },
    textDone: { textDecorationLine: 'line-through', color: '#bbb' },
    deleteBtn: { padding: 10, marginLeft: 5, zIndex: 10 },
    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#4A90E2', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor:'#4A90E2', shadowOpacity:0.4, shadowRadius:10, shadowOffset:{width:0, height:4} },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '85%', backgroundColor: 'white', borderRadius: 20, padding: 25, elevation:5, display:'flex' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color:'#333' },
    modalInput: { backgroundColor: '#F5F7FA', padding: 12, borderRadius: 12, marginBottom: 10, fontSize:15 },
    label: { fontWeight: 'bold', color: '#4A90E2', marginTop: 10, marginBottom: 8, fontSize:13, display:'flex', alignItems:'center', gap:5 },
    timeBtn: { flex:1, backgroundColor: '#eef6ff', padding: 10, borderRadius: 10, alignItems: 'center' },
    timeBtnText: { color: '#4A90E2', fontWeight: 'bold', fontSize: 14 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionBtn: { paddingVertical: 8, paddingHorizontal:12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', backgroundColor:'white' },
    selectedBtn: { backgroundColor: '#333', borderColor: '#333' },
    optionText: { color: '#666', fontSize:13 },
    selectedText: { color: 'white', fontWeight: 'bold' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 15, borderTopWidth:1, borderTopColor:'#eee', paddingTop:15 },
    cancelBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
    saveBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: '#4A90E2', alignItems: 'center' },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 20, marginTop: 15, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, elevation: 1, shadowColor:'#000', shadowOpacity:0.05 },
    toastContainer: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', zIndex: 999 },
    toastText: { backgroundColor: 'rgba(50, 50, 50, 0.9)', color: 'white', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, overflow: 'hidden', fontWeight:'bold', fontSize:14 },
    fileBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'#f9f9f9', padding:15, borderRadius:12, borderStyle:'dashed', borderWidth:1, borderColor:'#ccc', marginBottom:10 }
});