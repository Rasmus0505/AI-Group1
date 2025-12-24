import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import TestWebSocket from './pages/TestWebSocket';
import Rooms from './pages/Rooms';
import WaitingRoom from './pages/WaitingRoom';
import HostSetup from './pages/HostSetup';
import GameSessionPage from './pages/GameSession';
import HostReview from './pages/HostReview';
import InferenceResult from './pages/InferenceResult';
import EventProgress from './pages/EventProgress';
import GameState from './pages/GameState';
import GameHistory from './pages/GameHistory';
import Trade from './pages/Trade';
import GameSave from './pages/GameSave';
import Tasks from './pages/Tasks';
import StrategyAnalysis from './pages/StrategyAnalysis';
import DecisionConsole from './pages/DecisionConsole';
import ProtectedRoute from './components/ProtectedRoute';
import { useClickExplosion } from './hooks/useClickExplosion';
import './App.css';

const { Content } = Layout;

function App() {
  useClickExplosion();

  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Content>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms"
              element={
                <ProtectedRoute>
                  <Rooms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms/:roomId/wait"
              element={
                <ProtectedRoute>
                  <WaitingRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms/:roomId/host-setup"
              element={
                <ProtectedRoute>
                  <HostSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId"
              element={
                <ProtectedRoute>
                  <GameSessionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/review"
              element={
                <ProtectedRoute>
                  <HostReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/round/:round/inference"
              element={
                <ProtectedRoute>
                  <InferenceResult />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/events"
              element={
                <ProtectedRoute>
                  <EventProgress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/state"
              element={
                <ProtectedRoute>
                  <GameState />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/history"
              element={
                <ProtectedRoute>
                  <GameHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/trade"
              element={
                <ProtectedRoute>
                  <Trade />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/saves"
              element={
                <ProtectedRoute>
                  <GameSave />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/tasks"
              element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/game/:sessionId/decision-console"
              element={
                <ProtectedRoute>
                  <DecisionConsole />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user/strategies"
              element={
                <ProtectedRoute>
                  <StrategyAnalysis />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/test-websocket" element={<TestWebSocket />} />
          </Routes>
        </Content>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
