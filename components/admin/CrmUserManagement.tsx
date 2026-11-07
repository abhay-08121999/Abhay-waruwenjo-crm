import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';

import {
  assignCrmRole,
  createCrmRole,
  createCrmUser,
  DEFAULT_ROLE_PERMISSIONS,
  deleteCrmRole,
  type CrmRole,
  type CrmUser,
  fetchCrmRoles,
  fetchCrmUsers,
  setCrmUserActive,
  updateCrmRole,
} from '@/services/roles';

const emptyPermissions = () =>
  Object.fromEntries(
    DEFAULT_ROLE_PERMISSIONS.map((permission) => [permission.key, false]),
  );

const CrmUserManagement = () => {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [roles, setRoles] = useState<CrmRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(true);
  const [showCreateRole, setShowCreateRole] = useState(false);

  // Which action picker is open: 'edit' | 'delete' | null
  const [rolePicker, setRolePicker] = useState<'edit' | 'delete' | null>(null);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<
    Record<string, boolean>
  >(emptyPermissions());

  const [editingRole, setEditingRole] = useState<CrmRole | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDescription, setEditRoleDescription] = useState('');
  const [editRolePermissions, setEditRolePermissions] = useState<
    Record<string, boolean>
  >({});

  const [deletingRole, setDeletingRole] = useState<CrmRole | null>(null);

  const [userForm, setUserForm] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role_id: '',
  });

  const load = async () => {
    setLoading(true);

    try {
      const [userResult, roleResult] = await Promise.all([
        fetchCrmUsers(),
        fetchCrmRoles(),
      ]);

      if (userResult.error) {
        toast.error(userResult.error.message || 'Unable to load CRM users.');
      } else {
        setUsers(userResult.data || []);
      }

      if (roleResult.error) {
        toast.error(roleResult.error.message || 'Unable to load CRM roles.');
      } else {
        setRoles(roleResult.data || []);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to load CRM data.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedRole = roles.find((role) => role.id === userForm.role_id);

  const customRoles = useMemo(
    () => roles.filter((role) => !role.is_system),
    [roles],
  );

  const createRole = async () => {
    const roleName = newRoleName.trim();

    if (!roleName) {
      toast.error('Enter a role name.');
      return;
    }

    const permissions: Record<string, boolean> = {};

    Object.entries(newRolePermissions).forEach(([key, enabled]) => {
      if (enabled) {
        permissions[key] = true;
      }
    });

    /* users.manage is intentionally excluded from custom roles. */
    delete permissions['users.manage'];

    setSaving('create-role');

    try {
      const result = await createCrmRole({
        name: roleName,
        description: newRoleDescription.trim(),
        permissions,
      });

      if (result.error) {
        toast.error(result.error.message || 'Unable to create role.');
        return;
      }

      toast.success(`Role "${roleName}" created successfully.`);

      setNewRoleName('');
      setNewRoleDescription('');
      setNewRolePermissions(emptyPermissions());
      setShowCreateRole(false);

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to create role.',
      );
    } finally {
      setSaving(null);
    }
  };

  const startEditRole = (role: CrmRole) => {
    if (role.is_system) {
      toast.error('System roles cannot be modified.');
      return;
    }

    setShowCreateRole(false);
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditRoleDescription(role.description || '');

    const permissions = emptyPermissions();

    Object.entries(role.permissions || {}).forEach(([key, value]) => {
      if (key !== 'users.manage') {
        permissions[key] = Boolean(value);
      }
    });

    setEditRolePermissions(permissions);
  };

  const cancelEditRole = () => {
    setEditingRole(null);
    setEditRoleName('');
    setEditRoleDescription('');
    setEditRolePermissions({});
  };

  const saveEditedRole = async () => {
    if (!editingRole) {
      return;
    }

    const roleName = editRoleName.trim();

    if (!roleName) {
      toast.error('Enter a role name.');
      return;
    }

    const permissions: Record<string, boolean> = {};

    Object.entries(editRolePermissions).forEach(([key, enabled]) => {
      if (enabled && key !== 'users.manage') {
        permissions[key] = true;
      }
    });

    setSaving(`edit-role-${editingRole.id}`);

    try {
      const result = await updateCrmRole(editingRole.id, {
        name: roleName,
        description: editRoleDescription.trim(),
        permissions,
      });

      if (result.error) {
        toast.error(result.error.message || 'Unable to update role.');
        return;
      }

      toast.success(`Role "${roleName}" updated successfully.`);

      cancelEditRole();

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to update role.',
      );
    } finally {
      setSaving(null);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) {
      return;
    }

    setSaving(`delete-role-${deletingRole.id}`);

    try {
      const result = await deleteCrmRole(deletingRole.id);

      if (result.error) {
        toast.error(result.error.message || 'Unable to delete role.');
        return;
      }

      toast.success(`Role "${deletingRole.name}" deleted successfully.`);

      if (editingRole?.id === deletingRole.id) {
        cancelEditRole();
      }

      setDeletingRole(null);

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to delete role.',
      );
    } finally {
      setSaving(null);
    }
  };

  const createUser = async () => {
    const username = userForm.username.trim();
    const fullName = userForm.full_name.trim();
    const email = userForm.email.trim();

    if (
      !username ||
      !fullName ||
      !email ||
      !userForm.password ||
      !userForm.role_id
    ) {
      toast.error(
        'Username, full name, email, password and role are required.',
      );
      return;
    }

    if (userForm.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    if (!selectedRole) {
      toast.error('Please select a valid CRM role.');
      return;
    }

    setSaving('create-user');

    try {
      const result = await createCrmUser({
        username,
        full_name: fullName,
        email,
        password: userForm.password,
        role_id: userForm.role_id,
      });

      if (result.error) {
        toast.error(result.error.message || 'Unable to create CRM user.');
        return;
      }

      toast.success(`${fullName} was created successfully.`);

      setUserForm({
        username: '',
        full_name: '',
        email: '',
        password: '',
        role_id: '',
      });

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to create CRM user.',
      );
    } finally {
      setSaving(null);
    }
  };

  const changeRole = async (user: CrmUser, roleId: string) => {
    if (!roleId) {
      return;
    }

    setSaving(user.user_id);

    try {
      const result = await assignCrmRole(user.user_id, roleId);

      if (result.error) {
        toast.error(result.error.message || 'Unable to assign role.');
        return;
      }

      toast.success('Role updated successfully.');

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to assign role.',
      );
    } finally {
      setSaving(null);
    }
  };

  const toggleActive = async (user: CrmUser) => {
    setSaving(user.user_id);

    try {
      const result = await setCrmUserActive(user.user_id, !user.is_active);

      if (result.error) {
        toast.error(
          result.error.message || 'Unable to update account status.',
        );
        return;
      }

      toast.success(user.is_active ? 'User deactivated.' : 'User activated.');

      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to update account status.',
      );
    } finally {
      setSaving(null);
    }
  };

  const visibleUsers = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) {
      return users;
    }

    return users.filter((user) => {
      const roleNames = user.roles.map((role) => role.name).join(' ');

      const searchable = [
        user.username || '',
        user.email || '',
        user.full_name || '',
        roleNames,
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(q);
    });
  }, [users, search]);

  const togglePermission = (
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    key: string,
    checked: boolean,
  ) => {
    if (key === 'users.manage') {
      return;
    }

    setter((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const roleActionBusy =
    saving !== null && saving !== 'create-user' && saving !== 'create-role';

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Users & Roles</h1>

          <p className="text-sm text-slate-500 mt-1">
            Super Admin controls CRM accounts, custom roles and permissions.
            Users never select their role at login.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* CREATE USER + CUSTOM ROLE MANAGEMENT */}
      <div className="grid xl:grid-cols-2 gap-6 items-start">
        {/* CREATE USER */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-teal-600" />
                  Create CRM User
                </CardTitle>

                <CardDescription>
                  Create a Supabase Auth account and assign its CRM role in one
                  protected operation.
                </CardDescription>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateUser((value) => !value)}
              >
                {showCreateUser ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>

          {showCreateUser && (
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    className="mt-1"
                    value={userForm.username}
                    onChange={(e) =>
                      setUserForm((current) => ({
                        ...current,
                        username: e.target.value,
                      }))
                    }
                    placeholder="rahul.bdm"
                    disabled={saving === 'create-user'}
                  />
                </div>

                <div>
                  <Label>Full Name</Label>
                  <Input
                    className="mt-1"
                    value={userForm.full_name}
                    onChange={(e) =>
                      setUserForm((current) => ({
                        ...current,
                        full_name: e.target.value,
                      }))
                    }
                    placeholder="Rahul Sharma"
                    disabled={saving === 'create-user'}
                  />
                </div>

                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    className="mt-1"
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm((current) => ({
                        ...current,
                        email: e.target.value,
                      }))
                    }
                    placeholder="rahul@waruwenjo.com"
                    disabled={saving === 'create-user'}
                  />
                </div>

                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    className="mt-1"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm((current) => ({
                        ...current,
                        password: e.target.value,
                      }))
                    }
                    placeholder="Minimum 8 characters"
                    disabled={saving === 'create-user'}
                  />
                </div>
              </div>

              <div>
                <Label>CRM Role</Label>

                <select
                  value={userForm.role_id}
                  onChange={(e) =>
                    setUserForm((current) => ({
                      ...current,
                      role_id: e.target.value,
                    }))
                  }
                  disabled={saving === 'create-user' || roles.length === 0}
                  className="mt-1 w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {roles.length ? 'Select role' : 'No roles available'}
                  </option>

                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                      {role.is_system ? ' • System' : ''}
                    </option>
                  ))}
                </select>

                {selectedRole?.description && (
                  <p className="text-xs text-slate-500 mt-2">
                    {selectedRole.description}
                  </p>
                )}
              </div>

              <Button
                onClick={() => void createUser()}
                disabled={saving === 'create-user' || !roles.length}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {saving === 'create-user' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating User...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* CUSTOM ROLE MANAGEMENT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              Manage Custom Roles
            </CardTitle>

            <CardDescription>
              Create a new CRM role, or click Edit / Delete and choose a custom
              role. System roles are protected.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRolePicker(null);
                  cancelEditRole();
                  setShowCreateRole((value) => !value);
                }}
                disabled={saving === 'create-role'}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Role
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  setRolePicker((current) =>
                    current === 'edit' ? null : 'edit',
                  )
                }
                disabled={roleActionBusy || customRoles.length === 0}
                className="w-full"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit Role
                <ChevronDown
                  className={`h-4 w-4 ml-1 transition-transform ${
                    rolePicker === 'edit' ? 'rotate-180' : ''
                  }`}
                />
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  setRolePicker((current) =>
                    current === 'delete' ? null : 'delete',
                  )
                }
                disabled={roleActionBusy || customRoles.length === 0}
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete Role
                <ChevronDown
                  className={`h-4 w-4 ml-1 transition-transform ${
                    rolePicker === 'delete' ? 'rotate-180' : ''
                  }`}
                />
              </Button>
            </div>

            {/* CUSTOM ROLE PICKER (opens on Edit / Delete click) */}
            {rolePicker && (
              <div className="rounded-md border bg-white">
                <div className="px-3 py-2 border-b bg-slate-50 rounded-t-md">
                  <p className="text-sm font-semibold text-slate-800">
                    {rolePicker === 'edit'
                      ? 'Select a custom role to edit'
                      : 'Select a custom role to delete'}
                  </p>
                </div>

                <div className="p-2 max-h-64 overflow-y-auto space-y-1">
                  {customRoles.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No custom roles created yet.
                    </p>
                  ) : (
                    customRoles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          if (rolePicker === 'edit') {
                            startEditRole(role);
                          } else {
                            setDeletingRole(role);
                          }

                          setRolePicker(null);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900 truncate">
                            {role.name}
                          </span>

                          {role.description && (
                            <span className="block text-xs text-slate-500 truncate">
                              {role.description}
                            </span>
                          )}
                        </span>

                        <Badge variant="outline">Custom</Badge>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* EDIT ROLE FORM */}
            {editingRole && (
              <div className="rounded-md border bg-white p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Edit Custom Role: {editingRole.name}
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Changes apply automatically to users assigned to this
                      role.
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelEditRole}
                    disabled={saving === `edit-role-${editingRole.id}`}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <div>
                    <Label>Role Name</Label>
                    <Input
                      className="mt-1"
                      value={editRoleName}
                      onChange={(e) => setEditRoleName(e.target.value)}
                      disabled={saving === `edit-role-${editingRole.id}`}
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Input
                      className="mt-1"
                      value={editRoleDescription}
                      onChange={(e) => setEditRoleDescription(e.target.value)}
                      disabled={saving === `edit-role-${editingRole.id}`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Permissions</Label>

                    <span className="text-xs text-slate-500">
                      Super Admin only: Users & Roles
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-1 max-h-44 overflow-y-auto pr-1">
                    {DEFAULT_ROLE_PERMISSIONS.map((permission) => {
                      const disabled = permission.key === 'users.manage';

                      return (
                        <label
                          key={permission.key}
                          className={`flex items-start gap-2 rounded-md border p-1.5 ${
                            disabled
                              ? 'cursor-not-allowed bg-slate-50 opacity-60'
                              : 'cursor-pointer hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              disabled
                                ? false
                                : Boolean(editRolePermissions[permission.key])
                            }
                            onChange={(e) =>
                              togglePermission(
                                setEditRolePermissions,
                                permission.key,
                                e.target.checked,
                              )
                            }
                            className="mt-1"
                            disabled={
                              saving === `edit-role-${editingRole.id}` ||
                              disabled
                            }
                          />

                          <span>
                            <span className="block text-sm font-semibold text-slate-800">
                              {permission.label}
                            </span>

                            <span className="block text-xs text-slate-500">
                              {permission.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelEditRole}
                    disabled={saving === `edit-role-${editingRole.id}`}
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={() => void saveEditedRole()}
                    disabled={saving === `edit-role-${editingRole.id}`}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {saving === `edit-role-${editingRole.id}` ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          {/* CREATE ROLE FORM */}
          {showCreateRole && (
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label>Role Name</Label>
                <Input
                  className="mt-1"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Patient Coordinator"
                  disabled={saving === 'create-role'}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  className="mt-1"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Coordinates patient documentation and appointments"
                  disabled={saving === 'create-role'}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Permissions</Label>

                  <span className="text-xs text-slate-500">
                    Users & Roles management is Super Admin only
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                  {DEFAULT_ROLE_PERMISSIONS.map((permission) => {
                    const disabled = permission.key === 'users.manage';

                    return (
                      <label
                        key={permission.key}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${
                          disabled
                            ? 'cursor-not-allowed bg-slate-50 opacity-60'
                            : 'cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            disabled
                              ? false
                              : Boolean(newRolePermissions[permission.key])
                          }
                          onChange={(e) =>
                            togglePermission(
                              setNewRolePermissions,
                              permission.key,
                              e.target.checked,
                            )
                          }
                          className="mt-1"
                          disabled={saving === 'create-role' || disabled}
                        />

                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            {permission.label}
                          </span>

                          <span className="block text-xs text-slate-500">
                            {permission.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={() => void createRole()}
                disabled={saving === 'create-role'}
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                {saving === 'create-role' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Role...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Role
                  </>
                )}
              </Button>
            </CardContent>
          )}
        </Card>
      </div>

      {/* USER LIST */}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>CRM Accounts</CardTitle>

            <CardDescription>
              Role assignment and activation are controlled by the Super Admin.
            </CardDescription>
          </div>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search username, name, email or role..."
            className="max-w-sm"
          />
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading CRM accounts...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Change Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleUsers.map((user) => {
                    const currentRole = user.roles[0];

                    return (
                      <tr key={user.user_id} className="border-b last:border-0">
                        <td className="p-3">
                          <p className="font-semibold">
                            {user.full_name || 'Unnamed user'}
                          </p>

                          <p className="text-xs text-slate-500">
                            @{user.username || '—'} · {user.email}
                          </p>
                        </td>

                        <td className="p-3">
                          <Badge variant={currentRole ? 'secondary' : 'outline'}>
                            {currentRole?.name || 'Unassigned'}
                          </Badge>
                        </td>

                        <td className="p-3">
                          <select
                            value={currentRole?.id || ''}
                            onChange={(event) =>
                              void changeRole(user, event.target.value)
                            }
                            disabled={saving === user.user_id}
                            className="w-52 h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            <option value="">Assign role</option>

                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-3">
                          <Badge
                            variant={user.is_active ? 'default' : 'destructive'}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={saving === user.user_id}
                            onClick={() => void toggleActive(user)}
                          >
                            {saving === user.user_id ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : user.is_active ? (
                              <>
                                <UserX className="w-4 h-4 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!visibleUsers.length && (
                <p className="py-8 text-center text-muted-foreground">
                  No CRM accounts found.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECURITY NOTICE */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6 text-sm text-amber-900">
          <strong>Security:</strong> passwords are stored only by Supabase Auth.
          They are never written to <code>crm_user_profiles</code>,{' '}
          <code>crm_roles</code>, or the frontend.
        </CardContent>
      </Card>

      {/* DELETE ROLE CONFIRMATION */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">
                    Delete Custom Role?
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    You are about to delete the custom role{' '}
                    <strong>"{deletingRole.name}"</strong>.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    This action cannot be undone. The backend will also prevent
                    deletion if any CRM user is still assigned to this role.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeletingRole(null)}
                  disabled={saving === `delete-role-${deletingRole.id}`}
                >
                  Cancel
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => void confirmDeleteRole()}
                  disabled={saving === `delete-role-${deletingRole.id}`}
                >
                  {saving === `delete-role-${deletingRole.id}` ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Role
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmUserManagement;