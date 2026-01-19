import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import dayjs from "dayjs";
import "./App.css";

function App() {
  const [filePath, setFilePath] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputPath, setInputPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    checkSettings();
  }, []);

  const filteredNotes = notes.filter(note => 
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function checkSettings() {
    try {
      const path = await invoke("get_settings");
      if (path) {
        setFilePath(path);
        loadNotes(path);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load settings.");
      setLoading(false);
    }
  }

  async function loadNotes(path) {
    setLoading(true);
    try {
      const result = await invoke("read_notes", { filePath: path });
      setNotes(result);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(typeof err === 'string' ? err : "Failed to load notes. Ensure the file exists and has the correct format.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenFile() {
    if (!filePath) return;
    try {
      await invoke("open_file", { path: filePath });
    } catch (err) {
      setError("Failed to open file: " + err);
    }
  }

  async function handleBrowse() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Text Files',
          extensions: ['txt']
        }]
      });
      
      if (selected) {
        setInputPath(selected);
        await saveAndLoad(selected);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to open file dialog: " + err);
    }
  }

  async function saveAndLoad(path) {
    try {
      await invoke("save_settings", { path });
      setFilePath(path);
      loadNotes(path);
    } catch (err) {
      setError("Failed to save settings: " + err);
    }
  }

  async function handleManualSave() {
    if (!inputPath) return;
    const cleanPath = inputPath.replace(/^"|"$/g, '').trim();
    await saveAndLoad(cleanPath);
  }

  function handleChangePath() {
    setInputPath(filePath || "");
    setFilePath(null);
    setNotes([]);
    setError(null);
  }

  if (loading && !filePath) {
      return <div className="setup-container">Loading settings...</div>;
  }

  if (!filePath) {
    return (
      <div className="setup-container">
        <h1>QuickNote Setup</h1>
        <p>Select your notes .txt file</p>
        
        <div style={{display: 'flex', gap: '10px', width: '100%', maxWidth: '400px', alignItems: 'center'}}>
          <input
            className="setup-input"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="C:\path\to\notes.txt"
            style={{flex: 1}}
          />
          <button className="btn" onClick={handleBrowse} style={{whiteSpace: 'nowrap'}}>
            Browse...
          </button>
        </div>

        <button className="btn" onClick={handleManualSave} style={{marginTop: '1rem', width: '200px'}}>
          Load Notes
        </button>
        {error && <p style={{color: '#ff6b6b'}}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <h1>QuickNote</h1>
        <div className="header-actions">
          <button className="btn action-btn" onClick={() => loadNotes(filePath)} title="Reload Notes">
            Reload
          </button>
          <button className="btn action-btn" onClick={handleOpenFile}>
            Open Source
          </button>
          <button className="btn change-path-btn" onClick={handleChangePath}>
            Change File
          </button>
        </div>
      </div>

      <div className="search-container">
        <input
          className="search-input"
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {error && <div className="error-banner">{error}</div>}

      {loading ? (
          <p>Loading notes...</p>
      ) : (
          <div className="notes-list">
            {filteredNotes.length === 0 && (
              <p className="no-results">
                {searchQuery ? "No notes match your search." : "No notes found in file."}
              </p>
            )}
            {filteredNotes.map((note, index) => (
              <div key={index} className="note-card">
                <span className="note-date">
                  {dayjs(note.date).format("dddd, MMMM D, h:mmA")}
                </span>
                <pre className="note-content">{note.content}</pre>
              </div>
            ))}
          </div>
      )}
    </div>
  );
}

export default App;
