import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components';
import {
  Home,
  Login,
  Register,
  Auctions,
  AuctionDetail,
  AuctionHistory,
  Dashboard,
  CreateAuction,
  Wallet,
  NotFound,
  Unauthorized,
  EditAuction
} from './pages';
import {
  AdminLayout,
  AdminDashboard,
  AdminUsers,
  AdminAuctions,
  AdminBids
} from './pages/admin';

/**
 * App Component
 * 
 * Main application with routing setup
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auctions" element={<Auctions />} />
          <Route path="/auctions/history" element={<AuctionHistory />} />
          <Route path="/auction/:id" element={<AuctionDetail />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/create" element={
            <ProtectedRoute>
              <CreateAuction />
            </ProtectedRoute>
          } />
          <Route path="/wallet" element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          } />
          <Route path="/auction/edit/:id" element={
            <ProtectedRoute>
              <EditAuction />
            </ProtectedRoute>
          } />

          {/* Admin Routes */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="auctions" element={<AdminAuctions />} />
              <Route path="bids" element={<AdminBids />} />
            </Route>
          </Route>

          {/* 404 Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
