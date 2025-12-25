import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
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
import ServerConfig from './pages/ServerConfig';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineIndicator from './components/OfflineIndicator';
import { useClickExplosion } from './hooks/useClickExplosion';
import './App.css';

const { Content } = Layout;

function RootLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <OfflineIndicator />
      <Content>
        <Outlet />
      </Content>
    </Layout>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <ProtectedRoute><Home /></ProtectedRoute> },
      { path: 'rooms', element: <ProtectedRoute><Rooms /></ProtectedRoute> },
      { path: 'rooms/:roomId/wait', element: <ProtectedRoute><WaitingRoom /></ProtectedRoute> },
      { path: 'rooms/:roomId/host-setup', element: <ProtectedRoute><HostSetup /></ProtectedRoute> },
      { path: 'game/:sessionId', element: <ProtectedRoute><GameSessionPage /></ProtectedRoute> },
      { path: 'game/:sessionId/review', element: <ProtectedRoute><HostReview /></ProtectedRoute> },
      { path: 'game/:sessionId/round/:round/inference', element: <ProtectedRoute><InferenceResult /></ProtectedRoute> },
      { path: 'game/:sessionId/events', element: <ProtectedRoute><EventProgress /></ProtectedRoute> },
      { path: 'game/:sessionId/state', element: <ProtectedRoute><GameState /></ProtectedRoute> },
      { path: 'game/history', element: <ProtectedRoute><GameHistory /></ProtectedRoute> },
      { path: 'game/:sessionId/trade', element: <ProtectedRoute><Trade /></ProtectedRoute> },
      { path: 'game/:sessionId/saves', element: <ProtectedRoute><GameSave /></ProtectedRoute> },
      { path: 'game/:sessionId/tasks', element: <ProtectedRoute><Tasks /></ProtectedRoute> },
      { path: 'game/:sessionId/decision-console', element: <ProtectedRoute><DecisionConsole /></ProtectedRoute> },
      { path: 'user/strategies', element: <ProtectedRoute><StrategyAnalysis /></ProtectedRoute> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'test-websocket', element: <TestWebSocket /> },
      { path: 'server-config', element: <ProtectedRoute><ServerConfig /></ProtectedRoute> },
    ],
  },
]);

function App() {
  useClickExplosion();
  return <RouterProvider router={router} />;
}

export default App;
