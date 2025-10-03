import React, { useState, useEffect } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SlotPlanner from "../components/SlotPlanner";
import PollVoting from "../components/PollVoting";
import ExpenseSplitter from "../components/ExpenseSplitter";
import "./EventDashboard.css";

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const EventDashboard = () => {
  const [eventId, setEventId] = useState(null);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [isModerator, setIsModerator] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [eventTitle, setEventTitle] = useState("");
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [participants, setParticipants] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (eventId) {
      setInviteLink(`https://bip.com/join/${eventId}`);
      fetchSummary();

      if (autoRefresh) {
        const interval = setInterval(fetchSummary, 10000);
        return () => clearInterval(interval);
      }
    }
  }, [eventId, autoRefresh]);

  const fetchSummary = async () => {
    if (!eventId) return;

    try {
      const response = await axios.get(
        `http://localhost:3001/events/${eventId}/summary`
      );
      setSummary(response.data);
      calculateAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const calculateAnalytics = (data) => {
    const analytics = {
      totalSlots: 0,
      totalVotes: 0,
      participationRate: 0,
      totalExpense: 0,
      pollData: [],
      slotData: [],
    };

    if (data.poll_results && data.poll_results.length > 0) {
      analytics.pollData = data.poll_results.map((result) => ({
        name: result.text,
        votes: result.votes || 0,
      }));
      analytics.totalVotes = data.poll_results.reduce(
        (sum, r) => sum + (r.votes || 0),
        0
      );
    }

    if (data.expenses) {
      analytics.totalExpense = data.expenses.total || 0;
    }

    analytics.participationRate = Math.min(95, 40 + analytics.totalVotes * 5);

    setAnalytics(analytics);
  };

  const handleCreateEvent = async () => {
    if (!eventTitle.trim()) {
      toast.error("Lütfen etkinlik adı girin!");
      return;
    }

    if (!userName.trim()) {
      toast.error("Lütfen adınızı girin!");
      return;
    }

    setLoading(true);
    try {
      const generatedUserId = `user_${Date.now()}`;
      setUserId(generatedUserId);

      const response = await axios.post("http://localhost:3001/events", {
        title: eventTitle,
        created_by: generatedUserId,
        group_id: `grup_${Date.now()}`,
      });

      setEventId(response.data.event_id);
      setIsModerator(true);
      setShowCreateForm(false);

      setParticipants([
        {
          id: generatedUserId,
          name: userName,
          role: "moderator",
          joinedAt: new Date(),
        },
      ]);

      toast.success(`🎉 "${eventTitle}" etkinliği oluşturuldu!`);
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Etkinlik oluşturulurken hata oluştu!");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (hours) => {
    if (!eventId) return;

    setLoading(true);
    try {
      await axios.post(`http://localhost:3001/events/${eventId}/remind`);
      toast.success(`🔔 ${hours} saat öncesi hatırlatma ayarlandı!`);
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error("Hatırlatma gönderilemedi!");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("📋 Kopyalandı!");
  };

  const downloadQRCode = () => {
    const canvas = document.getElementById("qr-code-canvas");
    if (!canvas) return;

    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `${eventTitle}_QR.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success("QR Kod indirildi!");
  };

  const formatSummaryForExport = () => {
    if (!summary) return "";

    let text = `═══════════════════════════════════════\n`;
    text += `       📋 ETKİNLİK ÖZETİ\n`;
    text += `═══════════════════════════════════════\n\n`;
    text += `📌 Etkinlik: ${eventTitle}\n`;
    text += `🆔 ID: ${eventId}\n`;
    text += `👤 Moderatör: ${userName}\n`;
    text += `📅 Oluşturulma: ${new Date(
      summary.event?.created_at
    ).toLocaleString("tr-TR")}\n`;
    text += `👥 Katılımcı: ${participants.length} kişi\n\n`;

    text += `─────────────────────────────────────\n`;
    text += `📅 TARİH SLOTLARI\n`;
    text += `─────────────────────────────────────\n`;

    if (summary.winning_slot) {
      const date = new Date(summary.winning_slot.start_time);
      const endDate = new Date(summary.winning_slot.end_time);
      text += `🏆 Kazanan Slot:\n`;
      text += `   📆 ${date.toLocaleDateString("tr-TR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}\n`;
      text += `   ⏰ ${date.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${endDate.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })}\n`;
      text += `   ✅ ${summary.winning_slot.yes_votes || 0} kişi katılıyor\n\n`;
    } else {
      text += `   ⚠️ Henüz slot eklenmemiş\n\n`;
    }

    text += `─────────────────────────────────────\n`;
    text += `📍 MEKAN OYLAMASI\n`;
    text += `─────────────────────────────────────\n`;

    if (summary.poll_results && summary.poll_results.length > 0) {
      const totalVotes = summary.poll_results.reduce(
        (sum, r) => sum + (r.votes || 0),
        0
      );
      summary.poll_results.forEach((result, idx) => {
        const percentage =
          totalVotes > 0 ? Math.round((result.votes / totalVotes) * 100) : 0;
        text += `${idx === 0 ? "   🏆" : "   •"} ${result.text}\n`;
        text += `      📍 ${result.location}\n`;
        text += `      📊 ${result.votes || 0} oy (%${percentage})\n`;
      });
      text += `\n   Toplam: ${totalVotes} oy\n\n`;
    } else {
      text += `   ⚠️ Henüz oylama başlatılmamış\n\n`;
    }

    text += `─────────────────────────────────────\n`;
    text += `💰 MASRAF PAYLAŞıMI\n`;
    text += `─────────────────────────────────────\n`;

    if (summary.expenses && summary.expenses.total > 0) {
      text += `💵 Toplam Harcama: ₺${summary.expenses.total.toFixed(2)}\n\n`;

      text += `   📝 Giderler:\n`;
      summary.expenses.items.forEach((item) => {
        text += `      • ${item.notes}: ₺${item.amount.toFixed(2)}\n`;
        text += `        (${item.user_id} ödedi)\n`;
      });

      text += `\n   👤 Bakiyeler:\n`;
      Object.entries(summary.expenses.balances).forEach(([user, balance]) => {
        const bal = balance.balance;
        if (bal > 0) {
          text += `      ✅ ${user}: +₺${bal.toFixed(2)} alacak\n`;
        } else if (bal < 0) {
          text += `      ❌ ${user}: ₺${Math.abs(bal).toFixed(2)} verecek\n`;
        } else {
          text += `      ⚖️ ${user}: Eşit\n`;
        }
      });
    } else {
      text += `   ⚠️ Henüz masraf eklenmemiş\n`;
    }

    text += `\n═══════════════════════════════════════\n`;
    text += `🔗 Davet Linki: ${inviteLink}\n`;
    text += `📱 BiP Kampüs Koordinatörü ile oluşturuldu\n`;
    text += `═══════════════════════════════════════\n`;

    return text;
  };

  if (showCreateForm) {
    return (
      <div className="dashboard-container">
        <ToastContainer position="top-right" autoClose={3000} />
        <div className="create-event-screen">
          <div className="create-card animated">
            <div className="logo-section">
              <div className="logo-circle">🎓</div>
              <h1>BiP Kampüs Koordinatörü</h1>
              <p className="subtitle">Etkinlik planlamanın en kolay yolu</p>
            </div>

            <div className="form-section">
              <div className="input-group-modern">
                <label>👤 Adınız</label>
                <input
                  type="text"
                  placeholder="Adınızı girin"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleCreateEvent()}
                />
              </div>

              <div className="input-group-modern">
                <label>📝 Etkinlik Adı</label>
                <input
                  type="text"
                  placeholder="örn: Etüt Gecesi, Proje Toplantısı, Hackathon"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleCreateEvent()}
                />
              </div>

              <button
                className="btn-create-modern"
                onClick={handleCreateEvent}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Oluşturuluyor...
                  </>
                ) : (
                  <>🚀 Etkinliği Başlat</>
                )}
              </button>
            </div>

            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">📅</div>
                <span>Tarih Planlama</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📍</div>
                <span>Mekan Seçimi</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">💰</div>
                <span>Masraf Paylaşımı</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔔</div>
                <span>Hatırlatıcılar</span>
              </div>
            </div>

            <div className="bot-commands-info">
              <h4>💬 Bot Komutları</h4>
              <div className="command-chips">
                <span className="chip">/yeni</span>
                <span className="chip">/slot</span>
                <span className="chip">/mekan</span>
                <span className="chip">/gider</span>
                <span className="chip">/ozet</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <header className="dashboard-header-modern">
        <div className="header-top">
          <div className="event-title-section">
            <h1>🎓 {eventTitle}</h1>
            <div className="badges">
              <span className="badge event-id">ID: {eventId}</span>
              {isModerator && (
                <span className="badge moderator">👑 Moderatör</span>
              )}
              <span className="badge participants">
                👥 {participants.length} kişi
              </span>
            </div>
          </div>

          <div className="header-actions-modern">
            <button className="action-btn" onClick={() => setShowQRCode(true)}>
              <span className="icon">📱</span>
              <span>QR Kod</span>
            </button>
            <button
              className="action-btn"
              onClick={() => copyToClipboard(inviteLink)}
            >
              <span className="icon">🔗</span>
              <span>Davet</span>
            </button>
            <button className="action-btn" onClick={() => setShowSummary(true)}>
              <span className="icon">📊</span>
              <span>Özet</span>
            </button>
            <button
              className="action-btn primary"
              onClick={() => handleSendReminder(24)}
            >
              <span className="icon">🔔</span>
              <span>Hatırlatıcı</span>
            </button>
          </div>
        </div>

        <nav className="tabs-modern">
          <button
            className={`tab-modern ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <span className="tab-icon">🏠</span>
            Genel Bakış
          </button>
          <button
            className={`tab-modern ${activeTab === "slots" ? "active" : ""}`}
            onClick={() => setActiveTab("slots")}
          >
            <span className="tab-icon">📅</span>
            Tarih Slotları
          </button>
          <button
            className={`tab-modern ${activeTab === "poll" ? "active" : ""}`}
            onClick={() => setActiveTab("poll")}
          >
            <span className="tab-icon">📍</span>
            Mekan Seçimi
          </button>
          <button
            className={`tab-modern ${activeTab === "expense" ? "active" : ""}`}
            onClick={() => setActiveTab("expense")}
          >
            <span className="tab-icon">💰</span>
            Masraflar
          </button>
          <button
            className={`tab-modern ${
              activeTab === "analytics" ? "active" : ""
            }`}
            onClick={() => setActiveTab("analytics")}
          >
            <span className="tab-icon">📈</span>
            Analytics
          </button>
        </nav>
      </header>

      <main className="dashboard-main-modern">
        {activeTab === "overview" && (
          <div className="overview-grid">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon blue">📅</div>
                <div className="stat-info">
                  <h3>{summary?.winning_slot ? "1" : "0"}</h3>
                  <p>Kazanan Slot</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green">📍</div>
                <div className="stat-info">
                  <h3>{analytics?.totalVotes || 0}</h3>
                  <p>Toplam Oy</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange">💰</div>
                <div className="stat-info">
                  <h3>₺{analytics?.totalExpense.toFixed(0) || 0}</h3>
                  <p>Toplam Masraf</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon purple">👥</div>
                <div className="stat-info">
                  <h3>%{analytics?.participationRate || 0}</h3>
                  <p>Katılım Oranı</p>
                </div>
              </div>
            </div>

            <div className="overview-content">
              <div className="overview-card">
                <h3>🗓️ Seçilen Tarih ve Saat</h3>
                {summary?.winning_slot ? (
                  <div className="selected-info">
                    <div className="info-row">
                      <span className="label">📆 Tarih:</span>
                      <span className="value">
                        {new Date(
                          summary.winning_slot.start_time
                        ).toLocaleDateString("tr-TR", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">⏰ Saat:</span>
                      <span className="value">
                        {new Date(
                          summary.winning_slot.start_time
                        ).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" - "}
                        {new Date(
                          summary.winning_slot.end_time
                        ).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">✅ Katılımcı:</span>
                      <span className="value success">
                        {summary.winning_slot.yes_votes || 0} kişi
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state-small">
                    <p>⏳ Henüz slot seçilmedi</p>
                    <button
                      className="btn-small"
                      onClick={() => setActiveTab("slots")}
                    >
                      Slot Ekle
                    </button>
                  </div>
                )}
              </div>

              <div className="overview-card">
                <h3>📍 Seçilen Mekan</h3>
                {summary?.poll_results && summary.poll_results.length > 0 ? (
                  <div className="selected-info">
                    <div className="place-winner">
                      <div className="place-icon">🏆</div>
                      <div className="place-details">
                        <h4>{summary.poll_results[0].text}</h4>
                        <p className="location">
                          📍 {summary.poll_results[0].location}
                        </p>
                        <p className="vote-count">
                          {summary.poll_results[0].votes} oy ile kazandı
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state-small">
                    <p>⏳ Henüz mekan seçilmedi</p>
                    <button
                      className="btn-small"
                      onClick={() => setActiveTab("poll")}
                    >
                      Oylama Başlat
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "slots" && (
          <div className="tab-content">
            <SlotPlanner eventId={eventId} userId={userId} />
          </div>
        )}

        {activeTab === "poll" && (
          <div className="tab-content">
            <PollVoting eventId={eventId} userId={userId} />
          </div>
        )}

        {activeTab === "expense" && (
          <div className="tab-content">
            <ExpenseSplitter eventId={eventId} userId={userId} />
          </div>
        )}

        {activeTab === "analytics" && analytics && (
          <div className="analytics-grid">
            <div className="chart-card">
              <h3>📊 Mekan Oyları Dağılımı</h3>
              {analytics.pollData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.pollData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="votes" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">
                  <p>📊 Henüz oylama verisi yok</p>
                </div>
              )}
            </div>

            <div className="chart-card">
              <h3>🥧 Oy Dağılımı (Pie Chart)</h3>
              {analytics.pollData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.pollData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="votes"
                    >
                      {analytics.pollData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">
                  <p>🥧 Henüz oylama verisi yok</p>
                </div>
              )}
            </div>

            <div className="metrics-card">
              <h3>📈 Önemli Metrikler</h3>
              <div className="metrics-list">
                <div className="metric-item">
                  <span className="metric-label">Katılım Oranı</span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${analytics.participationRate}%` }}
                    ></div>
                  </div>
                  <span className="metric-value">
                    {analytics.participationRate}%
                  </span>
                </div>

                <div className="metric-item">
                  <span className="metric-label">Toplam Oy</span>
                  <span className="metric-value large">
                    {analytics.totalVotes}
                  </span>
                </div>

                <div className="metric-item">
                  <span className="metric-label">
                    Ortalama Kişi Başı Masraf
                  </span>
                  <span className="metric-value large">
                    ₺
                    {participants.length > 0
                      ? (analytics.totalExpense / participants.length).toFixed(
                          2
                        )
                      : "0.00"}
                  </span>
                </div>

                <div className="metric-item">
                  <span className="metric-label">Aktif Katılımcı</span>
                  <span className="metric-value large">
                    {participants.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="participants-card">
              <h3>👥 Katılımcılar</h3>
              <div className="participants-list">
                {participants.map((participant) => (
                  <div key={participant.id} className="participant-item">
                    <div className="participant-avatar">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="participant-info">
                      <h4>{participant.name}</h4>
                      <p>
                        {participant.role === "moderator"
                          ? "👑 Moderatör"
                          : "👤 Katılımcı"}
                      </p>
                    </div>
                    <span className="join-time">
                      {new Date(participant.joinedAt).toLocaleTimeString(
                        "tr-TR",
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {showQRCode && (
        <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
          <div
            className="modal-content qr-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>📱 QR Kod ile Davet</h2>
              <button
                className="close-btn"
                onClick={() => setShowQRCode(false)}
              >
                ✕
              </button>
            </div>
            <div className="qr-content">
              <div className="qr-wrapper">
                <QRCodeCanvas
                  id="qr-code-canvas"
                  value={inviteLink}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="qr-description">
                Bu QR kodu taratarak etkinliğe katılabilirsiniz
              </p>
              <div className="qr-actions">
                <button
                  className="btn-secondary"
                  onClick={() => copyToClipboard(inviteLink)}
                >
                  🔗 Linki Kopyala
                </button>
                <button className="btn-primary" onClick={downloadQRCode}>
                  💾 QR Kodu İndir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSummary && summary && (
        <div className="modal-overlay" onClick={() => setShowSummary(false)}>
          <div
            className="modal-content summary-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>📊 Etkinlik Özet Raporu</h2>
              <button
                className="close-btn"
                onClick={() => setShowSummary(false)}
              >
                ✕
              </button>
            </div>
            <div className="summary-content-area">
              <pre className="summary-text">{formatSummaryForExport()}</pre>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => copyToClipboard(formatSummaryForExport())}
              >
                📋 Özeti Kopyala
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  const blob = new Blob([formatSummaryForExport()], {
                    type: "text/plain",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${eventTitle}_ozet.txt`;
                  a.click();
                  toast.success("Özet dosyası indirildi!");
                }}
              >
                💾 Dosya Olarak İndir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDashboard;
