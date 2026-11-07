import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../lib/auth.tsx';
import { AppRole } from '../types';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  patient_id?: string | null;
  created_at: string;
  updated_at: string;
  roles: string[];
}

const UserManagement: React.FC = () => {
  const { currentUserRole } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const availableRoles: string[] = [
    'admin',
    'patient_coordinator',
    'in_house_doctor',
    'medical_manager',
    'bdm',
    'cdm',
    'waru_buddy',
    'hospital_admin',
    'agent',
    'indian_doctor',
    'international_doctor',
    'user',
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (profilesError) throw profilesError;

      const usersWithRoles: UserProfile[] = [];
      for (const profile of profilesData || []) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id);

        usersWithRoles.push({
          ...profile,
          roles: (rolesData || []).map(r => r.role as AppRole),
        });
      }

      setUsers(usersWithRoles);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
        });

      if (error) {
        console.error('Error assigning role:', error);
        return;
      }

      await fetchUsers();
    } catch (err) {
      console.error('Error in handleAssignRole:', err);
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) {
        console.error('Error removing role:', error);
        return;
      }

      await fetchUsers();
    } catch (err) {
      console.error('Error in handleRemoveRole:', err);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-500 text-sm">Manage user roles and permissions</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Roles</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{user.full_name || 'N/A'}</div>
                      <div className="text-xs text-slate-500">ID: {user.id.slice(0, 8)}...</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}
                          >
                            {ROLE_DISPLAY_NAMES[role]}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No roles assigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignRole(user.id, e.target.value as AppRole);
                          e.target.value = '';
                        }
                      }}
                      className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      defaultValue=""
                    >
                      <option value="" disabled>Add Role...</option>
                      {availableRoles
                        .filter(r => !user.roles.includes(r))
                        .map((role) => (
                          <option key={role} value={role}>
                            {ROLE_DISPLAY_NAMES[role]}
                          </option>
                        ))}
                    </select>
                    {user.roles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <button
                            key={role}
                            onClick={() => handleRemoveRole(user.id, role)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove {ROLE_DISPLAY_NAMES[role]}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;