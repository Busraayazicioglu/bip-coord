import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "./PollVoting.css";

const API_BASE =
  import.meta?.env?.VITE_API_BASE_URL ||
  process.env?.REACT_APP_API_BASE_URL ||
  "http://localhost:3001";

const PollVoting = ({ eventId, userId }) => {
  const [pollId, setPollId] = useState(null);
  const [choices, setChoices] = useState([]);
  const [newPlace, setNewPlace] = useState({ text: "", location: "" });
  const [loading, setLoading] = useState(false);
  const [pollCreated, setPollCreated] = useState(false);
  const [myChoiceId, setMyChoiceId] = useState(null); // kullanıcının oyu

  const fetchPoll = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/events/${eventId}/summary`, {
        timeout: 15000,
      });

      // Beklenen yapı: res.data.poll_results = [{ choice_id, text, location, votes, user_choice? }, ...]
      const results = res?.data?.poll_results || [];
      if (results.length > 0) {
        setPollCreated(true);
        // poll_id varsa al
        const pid = res?.data?.poll?.poll_id ?? res?.data?.poll_id ?? 1;
        setPollId(pid);

        // Kullanıcının oyu backend dönüyorsa çek
        // Bazı API'lar her choice'a user_voted: true/false koyabilir;
        // bazıları res.data.my_vote.choice_id döndürebilir.
        let mine = res?.data?.my_vote?.choice_id ?? null;
        if (!mine) {
          const voted = results.find(
            (c) => c.user_voted === true || c.user_choice === true
          );
          if (voted) mine = voted.choice_id ?? null;
        }
        setMyChoiceId(mine || null);

        // choices içinde choice_id ve votes güvence altına al
        setChoices(
          results.map((c, idx) => ({
            choice_id: c.choice_id ?? idx + 1,
            text: c.text,
            location: c.location,
            votes: Number(c.votes || 0),
          }))
        );
      } else {
        setPollCreated(false);
        setChoices([]);
        setMyChoiceId(null);
      }
    } catch (error) {
      console.error("Error fetching poll:", error);
    }
  }, [eventId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  const createPoll = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/events/${eventId}/poll`, {
        question: "Nerede buluşalım?",
        choices: [
          { text: "Ek Bina Kafe", location: "Mühendislik Fakültesi Yanı" },
          { text: "Merkez Kütüphane", location: "Kampüs Merkez" },
          { text: "Sosyal Tesis", location: "Yurt Yakını" },
        ],
      });
      setPollCreated(true);
      await fetchPoll();
      alert("Anket oluşturuldu!");
    } catch (error) {
      console.error("Error creating poll:", error);
      alert("Hata oluştu!");
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = useMemo(
    () => choices.reduce((sum, c) => sum + (c.votes || 0), 0),
    [choices]
  );

  const winningChoice = useMemo(() => {
    if (!choices.length) return null;
    return choices.reduce(
      (max, c) => (c.votes > (max?.votes || 0) ? c : max),
      choices[0]
    );
  }, [choices]);

  const handleVote = async (choiceId) => {
    if (!pollCreated) return;
    const effectivePollId = pollId ?? 1;

    // İyimser güncelleme: eski oy varsa geri al, yeniye ekle
    setChoices((prev) =>
      prev.map((c) => {
        let v = c.votes || 0;
        if (myChoiceId && c.choice_id === myChoiceId) v = Math.max(0, v - 1);
        if (c.choice_id === choiceId) v = v + 1;
        return { ...c, votes: v };
      })
    );
    const prevChoice = myChoiceId;
    setMyChoiceId(choiceId);

    try {
      await axios.post(`${API_BASE}/events/${eventId}/vote`, {
        user_id: userId,
        poll_id: effectivePollId,
        choice_id: choiceId,
      });
      // Sunucu ile senkronize et
      fetchPoll();
      // alert yerine sessiz güncelleme tercih edildi (UI'da chip gözüküyor)
    } catch (error) {
      // Hata: local değişiklikleri geri al
      setChoices((prev) =>
        prev.map((c) => {
          let v = c.votes || 0;
          if (c.choice_id === choiceId) v = Math.max(0, v - 1);
          if (prevChoice && c.choice_id === prevChoice) v = v + 1;
          return { ...c, votes: v };
        })
      );
      setMyChoiceId(prevChoice || null);

      if (error.response?.status === 429) {
        alert("Çok hızlı oy veriyorsunuz. 2 saniye bekleyin.");
      } else if (error.response?.status === 403) {
        alert("Oylama kilitlendi!");
      } else {
        console.error("Error voting:", error);
        alert("Hata oluştu!");
      }
    }
  };

  const handleAddPlace = async () => {
    if (!newPlace.text.trim()) {
      alert("Lütfen mekan adı girin!");
      return;
    }
    setLoading(true);
    try {
      // Backend’de endpoint varsa buraya entegre et:
      // await axios.post(`${API_BASE}/events/${eventId}/poll/choice`, { text: newPlace.text, location: newPlace.location });
      alert("Mekan önerisi eklendi!");
      setNewPlace({ text: "", location: "" });
      // fetchPoll();
    } catch (error) {
      console.error("Error adding place:", error);
      alert("Hata oluştu!");
    } finally {
      setLoading(false);
    }
  };

  if (!pollCreated) {
    return (
      <div className="poll-voting">
        <div className="header">
          <h2>📍 Mekan Seçimi</h2>
          <p>Buluşma yerini belirleyin</p>
        </div>
        <div className="empty-state">
          <p>Henüz anket oluşturulmamış</p>
          <button
            className="btn-primary"
            onClick={createPoll}
            disabled={loading}
          >
            {loading ? "Oluşturuluyor..." : "+ Anket Oluştur"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="poll-voting">
      <div className="header">
        <h2>📍 Mekan Seçimi</h2>
        <p>Buluşma yerini belirleyin</p>
      </div>

      <div className="poll-question">
        <span>Nerede buluşalım?</span>
      </div>

      <div className="choices-list">
        {choices.map((choice) => {
          const percentage =
            totalVotes > 0 ? Math.round((choice.votes / totalVotes) * 100) : 0;
          const isWinner =
            winningChoice && choice.choice_id === winningChoice.choice_id;
          const isMine = myChoiceId === choice.choice_id;

          return (
            <div
              key={choice.choice_id}
              className={`choice-card ${isWinner ? "winner" : ""} ${
                isMine ? "voted" : ""
              }`}
              onClick={() => handleVote(choice.choice_id)}
              role="button"
              aria-pressed={isMine ? "true" : "false"}
              title={isMine ? "Bu seçeneğe oy verdiniz" : "Oy ver"}
            >
              <div className="choice-header">
                <h3>
                  {isWinner ? "🏆 " : ""}
                  {choice.text}
                </h3>
                {isMine && <span className="my-vote-chip">Senin oyun</span>}
              </div>

              <div className="vote-bar">
                <div
                  className="vote-progress"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>

              <div className="choice-footer">
                <span className="location">📍 {choice.location || "—"}</span>
                <span className="vote-count">
                  {choice.votes} oy ({percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="add-place">
        <h3>Mekan Öner</h3>
        <input
          type="text"
          placeholder="Mekan adı"
          value={newPlace.text}
          onChange={(e) => setNewPlace({ ...newPlace, text: e.target.value })}
        />
        <input
          type="text"
          placeholder="Konum (opsiyonel)"
          value={newPlace.location}
          onChange={(e) =>
            setNewPlace({ ...newPlace, location: e.target.value })
          }
        />
        <button
          className="btn-secondary"
          onClick={handleAddPlace}
          disabled={loading}
        >
          + Mekan Ekle
        </button>
      </div>
    </div>
  );
};

export default PollVoting;
