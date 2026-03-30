/**
 * AEP Agent Orchestrator - React Dashboard
 * Main application component for managing journeys and analytics
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OrchestratorDashboard.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== COMPONENTS ====================

// Audience Management Component
function AudiencePanel() {
  const [audiences, setAudiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newAudience, setNewAudience] = useState({
    segment: '',
    age: '',
    interests: [],
  });

  useEffect(() => {
    fetchAudiences();
  }, []);

  const fetchAudiences = async () => {
    setLoading(true);
    try {
      const response = await client.get('/audiences?status=active');
      setAudiences(response.data.data || []);
    } catch (error) {
      console.error('Error fetching audiences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAudience = async (e) => {
    e.preventDefault();
    try {
      const response = await client.post('/audiences', newAudience);
      setAudiences([...audiences, response.data.data]);
      setNewAudience({ segment: '', age: '', interests: [] });
      alert('Audience created successfully!');
    } catch (error) {
      console.error('Error creating audience:', error);
      alert('Failed to create audience');
    }
  };

  return (
    <div className="panel audience-panel">
      <h2>📊 Audience Management</h2>

      <form onSubmit={handleCreateAudience} className="form">
        <h3>Create New Audience</h3>

        <input
          type="text"
          placeholder="Segment (e.g., school-aged)"
          value={newAudience.segment}
          onChange={(e) => setNewAudience({ ...newAudience, segment: e.target.value })}
          required
        />

        <input
          type="number"
          placeholder="Age"
          value={newAudience.age}
          onChange={(e) => setNewAudience({ ...newAudience, age: e.target.value })}
          required
        />

        <input
          type="text"
          placeholder="Interests (comma-separated)"
          onChange={(e) => setNewAudience({
            ...newAudience,
            interests: e.target.value.split(',').map(i => i.trim())
          })}
        />

        <button type="submit" className="btn btn-primary">Create Audience</button>
      </form>

      <div className="list">
        <h3>Active Audiences ({audiences.length})</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {audiences.map((aud) => (
              <li key={aud.audienceId} className="list-item">
                <div className="item-header">
                  <strong>{aud.name}</strong>
                  <span className={`badge badge-${aud.status}`}>{aud.status}</span>
                </div>
                <small>ID: {aud.audienceId}</small>
                <small>Category: {aud.userCategory}</small>
                <small>Size: {aud.size || 'N/A'}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Content Management Component
function ContentPanel() {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('8-10yrs');
  const [newContent, setNewContent] = useState({
    title: '',
    type: 'training_video',
    ageSegment: '8-10yrs',
    assetUrl: '',
    description: '',
    tags: [],
  });

  const contentTypes = [
    'teaser_video',
    'training_video',
    'one_page_image',
    'ppt',
    'pdf',
    'document',
    'exam',
  ];

  const ageSegments = ['0-2yrs', '8-10yrs', '11-17yrs', '18+'];

  useEffect(() => {
    fetchContentBySegment();
  }, [selectedSegment]);

  const fetchContentBySegment = async () => {
    setLoading(true);
    try {
      const response = await client.get(`/content/segment/${selectedSegment}`);
      setContents(response.data.data || []);
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContent = async (e) => {
    e.preventDefault();
    try {
      const response = await client.post('/content', newContent);
      alert('Content created! Now publish it to make it available.');
      setNewContent({
        title: '',
        type: 'training_video',
        ageSegment: '8-10yrs',
        assetUrl: '',
        description: '',
        tags: [],
      });
    } catch (error) {
      console.error('Error creating content:', error);
      alert('Failed to create content');
    }
  };

  const handlePublishContent = async (contentId) => {
    try {
      await client.post(`/content/${contentId}/publish`);
      alert('Content published successfully!');
      fetchContentBySegment();
    } catch (error) {
      console.error('Error publishing content:', error);
      alert('Failed to publish content');
    }
  };

  return (
    <div className="panel content-panel">
      <h2>📚 Content Management</h2>

      <form onSubmit={handleCreateContent} className="form">
        <h3>Create New Content</h3>

        <input
          type="text"
          placeholder="Title"
          value={newContent.title}
          onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
          required
        />

        <select
          value={newContent.type}
          onChange={(e) => setNewContent({ ...newContent, type: e.target.value })}
        >
          {contentTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <select
          value={newContent.ageSegment}
          onChange={(e) => setNewContent({ ...newContent, ageSegment: e.target.value })}
        >
          {ageSegments.map(seg => (
            <option key={seg} value={seg}>{seg}</option>
          ))}
        </select>

        <input
          type="url"
          placeholder="Asset URL"
          value={newContent.assetUrl}
          onChange={(e) => setNewContent({ ...newContent, assetUrl: e.target.value })}
          required
        />

        <textarea
          placeholder="Description"
          value={newContent.description}
          onChange={(e) => setNewContent({ ...newContent, description: e.target.value })}
        />

        <input
          type="text"
          placeholder="Tags (comma-separated)"
          onChange={(e) => setNewContent({
            ...newContent,
            tags: e.target.value.split(',').map(t => t.trim())
          })}
        />

        <button type="submit" className="btn btn-primary">Create Content</button>
      </form>

      <div className="list">
        <h3>Content by Segment</h3>

        <div className="segment-selector">
          {ageSegments.map(seg => (
            <button
              key={seg}
              className={`btn ${selectedSegment === seg ? 'btn-active' : 'btn-secondary'}`}
              onClick={() => setSelectedSegment(seg)}
            >
              {seg}
            </button>
          ))}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {contents.map((content) => (
              <li key={content.contentId} className="list-item">
                <div className="item-header">
                  <strong>{content.title}</strong>
                  <span className={`badge badge-${content.status}`}>{content.status}</span>
                </div>
                <small>Type: {content.type}</small>
                <small>Tags: {content.tags.join(', ') || 'None'}</small>
                {content.status === 'draft' && (
                  <button
                    className="btn btn-small btn-success"
                    onClick={() => handlePublishContent(content.contentId)}
                  >
                    Publish
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Journey Management Component
function JourneyPanel() {
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newJourney, setNewJourney] = useState({
    name: '',
    audienceId: '',
    surveyEnabled: false,
    personalizedTrainingEnabled: false,
  });
  const [audiences, setAudiences] = useState([]);

  useEffect(() => {
    fetchJourneys();
    fetchAudiences();
  }, []);

  const fetchJourneys = async () => {
    setLoading(true);
    try {
      const response = await client.get('/journeys');
      setJourneys(response.data.data || []);
    } catch (error) {
      console.error('Error fetching journeys:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudiences = async () => {
    try {
      const response = await client.get('/audiences');
      setAudiences(response.data.data || []);
    } catch (error) {
      console.error('Error fetching audiences:', error);
    }
  };

  const handleCreateJourney = async (e) => {
    e.preventDefault();
    try {
      const response = await client.post('/journeys', {
        ...newJourney,
        steps: [],
      });
      setJourneys([...journeys, response.data.data]);
      setNewJourney({
        name: '',
        audienceId: '',
        surveyEnabled: false,
        personalizedTrainingEnabled: false,
      });
      alert('Journey created! You can now activate it.');
    } catch (error) {
      console.error('Error creating journey:', error);
      alert('Failed to create journey');
    }
  };

  const handleActivateJourney = async (journeyId) => {
    try {
      await client.post(`/journeys/${journeyId}/activate`);
      alert('Journey activated successfully!');
      fetchJourneys();
    } catch (error) {
      console.error('Error activating journey:', error);
      alert('Failed to activate journey');
    }
  };

  return (
    <div className="panel journey-panel">
      <h2>🗺️ Journey Orchestration</h2>

      <form onSubmit={handleCreateJourney} className="form">
        <h3>Create New Journey</h3>

        <input
          type="text"
          placeholder="Journey Name"
          value={newJourney.name}
          onChange={(e) => setNewJourney({ ...newJourney, name: e.target.value })}
          required
        />

        <select
          value={newJourney.audienceId}
          onChange={(e) => setNewJourney({ ...newJourney, audienceId: e.target.value })}
          required
        >
          <option value="">Select Audience</option>
          {audiences.map(aud => (
            <option key={aud.audienceId} value={aud.audienceId}>
              {aud.name}
            </option>
          ))}
        </select>

        <label>
          <input
            type="checkbox"
            checked={newJourney.surveyEnabled}
            onChange={(e) => setNewJourney({ ...newJourney, surveyEnabled: e.target.checked })}
          />
          Enable Survey
        </label>

        <label>
          <input
            type="checkbox"
            checked={newJourney.personalizedTrainingEnabled}
            onChange={(e) => setNewJourney({ ...newJourney, personalizedTrainingEnabled: e.target.checked })}
          />
          Enable Personalized Training
        </label>

        <button type="submit" className="btn btn-primary">Create Journey</button>
      </form>

      <div className="list">
        <h3>Journeys ({journeys.length})</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {journeys.map((journey) => (
              <li key={journey.journeyId} className="list-item">
                <div className="item-header">
                  <strong>{journey.name}</strong>
                  <span className={`badge badge-${journey.status}`}>{journey.status}</span>
                </div>
                <small>ID: {journey.journeyId}</small>
                <small>Steps: {journey.steps.length}</small>
                {journey.status === 'draft' && (
                  <button
                    className="btn btn-small btn-success"
                    onClick={() => handleActivateJourney(journey.journeyId)}
                  >
                    Activate
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Analytics Dashboard Component
function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [journeys, setJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJourneys();
  }, []);

  const fetchJourneys = async () => {
    try {
      const response = await client.get('/journeys');
      setJourneys(response.data.data || []);
    } catch (error) {
      console.error('Error fetching journeys:', error);
    }
  };

  const handleGetMetrics = async () => {
    if (!selectedJourney) {
      alert('Please select a journey');
      return;
    }

    setLoading(true);
    try {
      const response = await client.get(`/analytics/metrics/${selectedJourney}`);
      setMetrics(response.data.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      alert('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel analytics-panel">
      <h2>📈 Analytics & Insights</h2>

      <div className="metrics-selector">
        <select
          value={selectedJourney}
          onChange={(e) => setSelectedJourney(e.target.value)}
        >
          <option value="">Select Journey</option>
          {journeys.map(j => (
            <option key={j.journeyId} value={j.journeyId}>
              {j.name}
            </option>
          ))}
        </select>

        <button
          className="btn btn-primary"
          onClick={handleGetMetrics}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get Metrics'}
        </button>
      </div>

      {metrics && (
        <div className="metrics-display">
          <h3>Journey Metrics</h3>

          <div className="metric-card">
            <div className="metric-value">{metrics.totalEvents}</div>
            <div className="metric-label">Total Events</div>
          </div>

          <div className="metric-card">
            <div className="metric-value">{metrics.userEngagement.uniqueUsers}</div>
            <div className="metric-label">Unique Users</div>
          </div>

          <div className="metric-card">
            <div className="metric-value">{metrics.userEngagement.averageRating.toFixed(1)}/5</div>
            <div className="metric-label">Average Rating</div>
          </div>

          <div className="metric-card">
            <div className="metric-value">{metrics.userEngagement.feedbackCount}</div>
            <div className="metric-label">Feedback Count</div>
          </div>

          <h4>Events by Type</h4>
          <ul>
            {Object.entries(metrics.eventsByType).map(([type, count]) => (
              <li key={type}>
                <strong>{type}:</strong> {count} events
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Main Dashboard Component
export default function OrchestratorDashboard() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE}/../health`);
      setHealth(response.data);
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({ status: 'offline' });
    }
  };

  return (
    <div className="orchestrator-dashboard">
      <header className="dashboard-header">
        <h1>🎯 AEP Agent Orchestrator</h1>
        <p>Complete marketing automation platform with AI-powered personalization</p>

        <div className={`health-status ${health?.status || 'offline'}`}>
          <span className="status-dot"></span>
          <span>{health?.status || 'Offline'}</span>
        </div>
      </header>

      <main className="dashboard-grid">
        <AudiencePanel />
        <ContentPanel />
        <JourneyPanel />
        <AnalyticsDashboard />
      </main>

      <footer className="dashboard-footer">
        <p>AEP Agent Orchestrator v1.0.0 | Powered by Adobe Experience Platform</p>
      </footer>
    </div>
  );
}
