import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";

const API_BASE =
  import.meta?.env?.VITE_API_BASE_URL ||
  process.env?.REACT_APP_API_BASE_URL ||
  "http://localhost:3001";

const SlotPlanner = ({ eventId, userId }) => {
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [voteLoadingId, setVoteLoadingId] = useState(null);
  // Kullanıcının verdiği oyları yerelde tut (backend dönmüyorsa bile gösterelim)
  const [myVotes, setMyVotes] = useState({}); // { [slot_id]: 'yes' | 'no' }

  const fetchSlots = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await axios.get(
        `${API_BASE}/events/${eventId}/summary`,
        { timeout: 15000 }
      );
      // response.data.slots bekleniyor; yoksa boş
      const fetched = response?.data?.slots || [];
      setSlots(Array.isArray(fetched) ? fetched : []);
      // Eğer backend kullanıcı oyunu dönüyorsa (ör. slot.user_choice), myVotes'u güncelle
      const mv = {};
      fetched.forEach((s) => {
        if (s.user_choice === "yes" || s.user_choice === "no") {
          mv[s.slot_id] = s.user_choice;
        }
      });
      if (Object.keys(mv).length) setMyVotes(mv);
    } catch (error) {
      console.error("Error fetching slots:", error);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Yeni eklenenin üstte görünmesi + genel tutarlılık için DESC sırala
  const sortedSlots = useMemo(() => {
    const list = Array.isArray(slots) ? [...slots] : [];
    return list.sort((a, b) => {
      const aT = new Date(a.start_time).getTime();
      const bT = new Date(b.start_time).getTime();
      // Önce kazananı en üste almak istersen b.isWinning - a.isWinning ekleyebilirsin
      return bT - aT; // en yeni/ilerideki slot üstte
    });
  }, [slots]);

  const handleAddSlot = async () => {
    if (!newSlot.start || !newSlot.end) {
      alert("Lütfen başlangıç ve bitiş zamanı girin!");
      return;
    }
    // datetime-local, timezone belirtmez; ISO'ya çevir
    const startISO = new Date(newSlot.start).toISOString();
    const endISO = new Date(newSlot.end).toISOString();

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/events/${eventId}/slots`, {
        start_time: startISO,
        end_time: endISO,
      });

      // Backend yeni slotu döndürüyorsa kullan; dönmüyorsa iyimser ekle
      const created = res?.data?.slot || {
        slot_id: `tmp_${Date.now()}`,
        start_time: startISO,
        end_time: endISO,
        yes_votes: 0,
        no_votes: 0,
        isWinning: false,
      };

      setSlots((prev) => [created, ...prev]); // üstte göster
      setNewSlot({ start: "", end: "" });
      // Sunucudaki gerçek veri ile senkronize et
      fetchSlots();
      alert("Slot başarıyla eklendi!");
    } catch (error) {
      console.error("Error adding slot:", error);
      alert("Hata oluştu!");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (slotId, choice) => {
    // Aynı slota peş peşe tıklamayı engelle
    if (voteLoadingId === slotId) return;
    setVoteLoadingId(slotId);

    // İyimser güncelleme: sayıları anında güncelle
    setSlots((prev) =>
      prev.map((s) => {
        if (s.slot_id !== slotId) return s;
        const yes = Number(s.yes_votes || 0);
        const no = Number(s.no_votes || 0);
        const prevChoice = myVotes[slotId];

        let nextYes = yes;
        let nextNo = no;

        // Önce önceki oyunu geri al
        if (prevChoice === "yes") nextYes = Math.max(0, yes - 1);
        if (prevChoice === "no") nextNo = Math.max(0, no - 1);

        // Sonra yeni oyu ekle
        if (choice === "yes") nextYes += 1;
        if (choice === "no") nextNo += 1;

        return { ...s, yes_votes: nextYes, no_votes: nextNo };
      })
    );
    setMyVotes((prev) => ({ ...prev, [slotId]: choice }));

    try {
      await axios.post(`${API_BASE}/events/${eventId}/vote-slot`, {
        user_id: userId,
        slot_id: slotId,
        choice,
      });
      // Sunucu sayıları ile eşitle
      fetchSlots();
    } catch (error) {
      // Hata durumunda iyimser güncellemeyi geri al
      setSlots((prev) =>
        prev.map((s) => {
          if (s.slot_id !== slotId) return s;
          const yes = Number(s.yes_votes || 0);
          const no = Number(s.no_votes || 0);
          // Geri alma: az önce yaptığımız değişimi tersine çevir
          let nextYes = yes;
          let nextNo = no;
          if (choice === "yes") nextYes = Math.max(0, yes - 1);
          if (choice === "no") nextNo = Math.max(0, no - 1);
          const prevChoice = myVotes[slotId];
          if (prevChoice === "yes") nextYes += 1;
          if (prevChoice === "no") nextNo += 1;
          return { ...s, yes_votes: nextYes, no_votes: nextNo };
        })
      );
      // seçim de geri al
      setMyVotes((prev) => {
        const copy = { ...prev };
        // geri eski haline
        if (copy[slotId]) copy[slotId] = copy[slotId];
        return copy;
      });

      if (error.response?.status === 429) {
        alert("Çok hızlı oy veriyorsunuz. 2 saniye bekleyin.");
      } else {
        console.error("Error voting:", error);
        alert("Hata oluştu!");
      }
    } finally {
      setVoteLoadingId(null);
    }
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString("tr-TR");
  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="slot-planner">
      <div className="header">
        <h2>📅 Tarih Slotları</h2>
        <p>Uygun olduğunuz zaman dilimlerini seçin</p>
      </div>

      <div className="slots-list">
        {sortedSlots.map((slot) => {
          const yes = Number(slot.yes_votes || slot.yes || 0);
          const no = Number(slot.no_votes || slot.no || 0);
          const total = yes + no;
          const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
          const my = myVotes[slot.slot_id]; // 'yes' | 'no' | undefined

          return (
            <div
              key={slot.slot_id}
              className={`slot-card ${slot.isWinning ? "winning" : ""}`}
            >
              <div className="slot-info">
                <h3>{fmtDate(slot.start_time)}</h3>
                <p className="time">
                  {fmtTime(slot.start_time)} {" - "} {fmtTime(slot.end_time)}
                </p>

                {/* Oy istatistikleri */}
                <div className="votes-line">
                  <span className="badge-yes">✓ {yes} Evet</span>
                  <span className="badge-no">✗ {no} Hayır</span>
                  <span className="badge-total">Toplam: {total}</span>
                </div>

                {/* Yüzde çubuğu */}
                <div className="vote-bar">
                  <div
                    className="vote-progress"
                    style={{ width: `${yesPct}%` }}
                    aria-label={`Evet yüzdesi: %${yesPct}`}
                  />
                </div>

                {typeof my === "string" && (
                  <p className="my-vote">
                    Senin oyun:{" "}
                    <strong>{my === "yes" ? "Evet" : "Hayır"}</strong>
                  </p>
                )}

                {slot.isWinning && (
                  <p className="votes winner-flag">🏆 Kazanan slot</p>
                )}
              </div>

              <div className="vote-buttons">
                <button
                  className="btn-yes"
                  onClick={() => handleVote(slot.slot_id, "yes")}
                  disabled={voteLoadingId === slot.slot_id}
                  aria-pressed={my === "yes"}
                  title="Evet"
                >
                  ✓
                </button>
                <button
                  className="btn-no"
                  onClick={() => handleVote(slot.slot_id, "no")}
                  disabled={voteLoadingId === slot.slot_id}
                  aria-pressed={my === "no"}
                  title="Hayır"
                >
                  ✗
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="add-slot">
        <h3>Yeni Slot Ekle</h3>
        <div className="input-group">
          <input
            type="datetime-local"
            value={newSlot.start}
            onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
            placeholder="Başlangıç"
          />
          <input
            type="datetime-local"
            value={newSlot.end}
            onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
            placeholder="Bitiş"
          />
        </div>
        <button
          className="btn-primary"
          onClick={handleAddSlot}
          disabled={loading}
        >
          {loading ? "Ekleniyor..." : "+ Slot Ekle"}
        </button>
      </div>
    </div>
  );
};

export default SlotPlanner;
