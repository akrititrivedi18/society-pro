import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove, query, orderByChild, startAt, update } from "firebase/database";
import './App.css';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyA1OiFe4erowpNU6pnh1hgolMdCRdkVRyU",
  authDomain: "societypro-41d26.firebaseapp.com",
  databaseURL: "https://societypro-41d26-default-rtdb.firebaseio.com",
  projectId: "societypro-41d26",
  storageBucket: "societypro-41d26.firebasestorage.app",
  messagingSenderId: "734071665872",
  appId: "1:734071665872:web:b602660c8757c4a1861ad5",
  measurementId: "G-NP5D4B975P"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const App = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('society_user')));
    const [isSignup, setIsSignup] = useState(false); 
    const [chats, setChats] = useState([]);
    const [formData, setFormData] = useState({ name: '', phone: '', room: '', email: '', password: '', role: 'Resident' });
    const [adminKey, setAdminKey] = useState(""); 
    const [activeModal, setActiveModal] = useState(null); 
    const [searchQuery, setSearchQuery] = useState(""); 

    const [rules, setRules] = useState([]);
    const [notices, setNotices] = useState([]);
    const [maintBalance, setMaintBalance] = useState("0.00");
    const [directory, setDirectory] = useState([]);
    
    const chatEnd = useRef(null);
    const SECRET_MANAGER_CODE = "1234"; 

    useEffect(() => {
        if (!user) return;

        // Auto-Logout Check (English Alert)
        const myAccountRef = ref(db, `users/${user.phone}`);
        onValue(myAccountRef, (snap) => {
            if (!snap.exists() && user.role !== 'Manager') {
                alert("Your account has been removed by the Manager.");
                localStorage.clear();
                window.location.reload();
            }
        });

        const userSettingsRef = ref(db, `users/${user.phone}/lastClear`);
        onValue(userSettingsRef, (clearSnap) => {
            const lastCleared = clearSnap.val() || 0;
            const chatQuery = query(ref(db, 'chats'), orderByChild('id'), startAt(lastCleared + 1));

            onValue(chatQuery, (snap) => {
                const data = snap.val();
                if (data) {
                    const list = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
                    setChats(list);
                } else { setChats([]); }
                setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 100);
            });
        });

        onValue(ref(db, 'directory'), (snap) => {
            const data = snap.val();
            if (data) {
                const list = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
                setDirectory(list);
            } else { setDirectory([]); }
        });

        onValue(ref(db, 'rules'), (snap) => setRules(snap.val() || []));
        onValue(ref(db, 'notices'), (snap) => setNotices(snap.val() || []));
        onValue(ref(db, 'maintBalance'), (snap) => setMaintBalance(snap.val() || "0.00"));
    }, [user]);

    const handleAuth = () => {
        if (isSignup) {
            if (!formData.phone || !formData.password || !formData.name) return alert("Please fill all the details!");
            if (formData.role === 'Manager' && adminKey !== SECRET_MANAGER_CODE) return alert("Invalid Manager Code!");
            
            set(ref(db, `users/${formData.phone}`), formData);
            set(ref(db, `directory/${formData.phone}`), formData);
            alert("Account created successfully! Please login now.");
            setIsSignup(false);
        } else {
            onValue(ref(db, `users/${formData.phone}`), (snap) => {
                const data = snap.val();
                if (data && data.password === formData.password) {
                    setUser(data);
                    localStorage.setItem('society_user', JSON.stringify(data));
                } else {
                    alert("Incorrect Phone number or Password!");
                }
            }, { onlyOnce: true });
        }
    };

    const removeResident = (phone) => {
        if (window.confirm("Are you sure you want to logout and delete this resident?")) {
            remove(ref(db, `users/${phone}`));
            remove(ref(db, `directory/${phone}`));
        }
    };

    const sendMsg = (text, type = "normal") => {
        if (!text.trim()) return;
        push(ref(db, 'chats'), { 
            id: Date.now(), sender: user.name, text, type, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        });
    };

    const editMessage = (key, currentText) => {
        const newText = prompt("Edit your message:", currentText);
        if (newText && newText !== currentText) {
            update(ref(db, `chats/${key}`), { text: newText + " (edited)" });
        }
    };

    const deleteForMe = (msgId) => set(ref(db, `users/${user.phone}/lastClear`), msgId);

    const deleteForEveryone = (firebaseKey) => {
        if (window.confirm("Delete this message for everyone?")) remove(ref(db, `chats/${firebaseKey}`));
    };

    const Modal = ({ type, onClose }) => {
        const [editVal, setEditVal] = useState("");
        const handleAdd = () => {
            if (!editVal) return;
            const dbPath = type === 'rules' ? 'rules' : (type === 'notice' ? 'notices' : 'maintBalance');
            if (type === 'balance') {
                set(ref(db, dbPath), editVal);
                sendMsg(`💳 Bill Updated: ₹${editVal}`);
            } else {
                const currentList = type === 'rules' ? rules : notices;
                set(ref(db, dbPath), [...currentList, editVal]);
                sendMsg((type === 'rules' ? "📘 New Rule: " : "📢 New Notice: ") + editVal);
            }
            setEditVal("");
        };

        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h2 style={{color: 'var(--accent)'}}>{type === 'balance' ? 'BILLING & SERVICES' : type.toUpperCase()}</h2>
                    <div className="directory-list">
                        {(type === 'rules' || type === 'notice') && (type === 'rules' ? rules : notices).map((item, i) => (
                            <div key={i} className="directory-item">
                                <span>{item}</span>
                                {user.role === 'Manager' && <button onClick={() => {
                                    const list = type === 'rules' ? [...rules] : [...notices];
                                    list.splice(i, 1);
                                    set(ref(db, type === 'rules' ? 'rules' : 'notices'), list);
                                }} style={{color:'red', border:'none', background:'none'}}>🗑️</button>}
                            </div>
                        ))}
                        {type === 'sos' && (
                            <div style={{textAlign:'center'}}>
                                <button className="login-btn" style={{background:'var(--sos-red)', marginBottom:'15px'}} onClick={() => {
                                    if (navigator.geolocation) {
                                        navigator.geolocation.getCurrentPosition((pos) => {
                                            sendMsg(`🚨 SOS! Current Location: http://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`, "sos");
                                        });
                                    }
                                }}>📍 Send Live Location</button>
                                <div className="sos-link-item" onClick={() => window.location.href='tel:100'}>📞 Police (100)</div>
                                <div className="sos-link-item" onClick={() => window.location.href='tel:102'}>🚑 Ambulance (102)</div>
                            </div>
                        )}
                        {type === 'balance' && (
                            <div style={{textAlign:'center'}}>
                                <h3>Outstanding Balance: ₹{maintBalance}</h3>
                                {user.role === 'Resident' && <button className="login-btn" style={{background:'var(--success)', marginTop:'10px'}} onClick={() => window.location.href=`upi://pay?pa=SOCIETY@upi&pn=Society&am=${maintBalance}&cu=INR`}>💳 Pay Online</button>}
                            </div>
                        )}
                    </div>
                    {user.role === 'Manager' && type !== 'sos' && (
                        <div style={{marginTop:'15px', borderTop:'1px solid var(--glass-border)', paddingTop:'15px'}}>
                            <input className="search-input" value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="Type here to add..." />
                            <button className="login-btn" onClick={handleAdd}>Save Changes</button>
                        </div>
                    )}
                    <button className="login-btn" style={{background:'#555', marginTop:'15px'}} onClick={onClose}>Close</button>
                </div>
            </div>
        );
    };

    if (!user) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <h1>SOCIETY<span>PRO</span></h1>
                    {isSignup && (
                        <>
                            <input placeholder="Full Name" onChange={e => setFormData({...formData, name: e.target.value})} />
                            <input placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} />
                            <input placeholder="Flat Number" onChange={e => setFormData({...formData, room: e.target.value})} />
                        </>
                    )}
                    <input placeholder="Phone Number" onChange={e => setFormData({...formData, phone: e.target.value})} />
                    <input placeholder="Password" type="password" onChange={e => setFormData({...formData, password: e.target.value})} />
                    {isSignup && (
                        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                            <option value="Resident">Resident</option>
                            <option value="Manager">Manager</option>
                        </select>
                    )}
                    {isSignup && formData.role === 'Manager' && (
                        <input placeholder="Enter Manager Access Code" type="password" style={{border:'2px solid var(--accent)'}} onChange={e => setAdminKey(e.target.value)} />
                    )}
                    <button className="login-btn" onClick={handleAuth}>{isSignup ? "Create Account" : "Login to Portal"}</button>
                    <p onClick={() => setIsSignup(!isSignup)} style={{cursor:'pointer', marginTop:'15px', fontSize:'0.9rem', color: '#3b82f6'}}>
                        {isSignup ? "Already have an account? Login" : "New Resident? Sign Up Here"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="main-container">
            {activeModal && <Modal type={activeModal} onClose={() => setActiveModal(null)} />}
            <div className="brand-logo">SOCIETY<span>PRO</span></div>
            <div className="dashboard-grid">
                <div className="grid-column">
                    <div className="glass-card" onClick={() => setActiveModal('rules')}>📘 Society Rules</div>
                    <div className="glass-card" onClick={() => setActiveModal('notice')}>📢 Notices & Alerts</div>
                    <div className="glass-card" style={{flex: 1, overflow: 'hidden'}}>
                        <h4>Society Directory ({directory.length})</h4>
                        <input className="search-input" placeholder="Search residents..." onChange={(e) => setSearchQuery(e.target.value.toLowerCase())} />
                        <div className="directory-list">
                            {directory.filter(u => u.name.toLowerCase().includes(searchQuery)).map((u, i) => (
                                <div key={i} className="directory-item" style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.1)', padding:'10px 0'}}>
                                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start'}}>
                                        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                            <span style={{fontWeight:'bold'}}>{u.name}</span>
                                            {u.role === 'Manager' && <span style={{background:'var(--accent)', color:'white', fontSize:'9px', padding:'2px 6px', borderRadius:'4px', fontWeight:'900'}}>⭐ MANAGER</span>}
                                        </div>
                                        <span>Unit: {u.room}</span>
                                        {user.role === 'Manager' && <small style={{color:'#aaa', fontSize:'0.75rem'}}>{u.phone} | {u.email}</small>}
                                    </div>
                                    {user.role === 'Manager' && u.phone !== user.phone && (
                                        <button onClick={() => removeResident(u.phone)} style={{background:'rgba(239, 68, 68, 0.2)', border:'none', color:'#ef4444', padding:'5px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'11px'}}>Revoke Access 🗑️</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass-card chat-card-main">
                    <h4>Community Discussion</h4>
                    <div className="chat-window">
                        {chats.map((m, i) => (
                            <div key={i} className={`bubble ${m.sender === user.name ? 'me' : 'them'}`}>
                                <div style={{display:'flex', justifyContent:'space-between'}}>
                                    <small>{m.sender} • {m.time}</small>
                                    <div style={{display:'flex', gap:'8px'}}>
                                        <span onClick={() => deleteForMe(m.id)} style={{cursor:'pointer', fontSize:'12px'}} title="Clear for me">👤</span>
                                        {m.sender === user.name && <span onClick={() => editMessage(m.firebaseKey, m.text)} style={{cursor:'pointer', fontSize:'12px'}} title="Edit">✏️</span>}
                                        {(m.sender === user.name || user.role === 'Manager') && <span onClick={() => deleteForEveryone(m.firebaseKey)} style={{cursor:'pointer', fontSize:'12px'}} title="Delete for all">🚮</span>}
                                    </div>
                                </div>
                                <p style={{margin:'5px 0 0 0'}}>{m.text}</p>
                            </div>
                        ))}
                        <div ref={chatEnd} />
                    </div>
                    <div className="chat-input-area">
                        <input id="msgBox" className="search-input" placeholder="Type a message..." onKeyPress={e => e.key === 'Enter' && document.getElementById('sendBtn').click()} />
                        <button id="sendBtn" className="login-btn" style={{width:'auto', padding:'0 20px'}} onClick={() => { const v=document.getElementById('msgBox'); sendMsg(v.value); v.value=''; }}>Send</button>
                    </div>
                </div>

                <div className="grid-column">
                    <div className="glass-card" style={{border: '2px solid var(--sos-red)', color:'var(--sos-red)', fontWeight:'bold'}} onClick={() => setActiveModal('sos')}>🚨 EMERGENCY SOS</div>
                    <div className="glass-card" onClick={() => setActiveModal('balance')}>🛠️ Bill/Services: ₹{maintBalance}</div>
                    <button className="logout-btn-link" onClick={() => {localStorage.clear(); window.location.reload();}}>Logout ({user.name})</button>
                </div>
            </div>
        </div>
    );
};

export default App;