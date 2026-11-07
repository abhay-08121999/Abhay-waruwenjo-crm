import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogOut, Users, Calendar, DollarSign, Building2, Stethoscope, TrendingUp, MessageSquare, Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DoctorForm } from "@/components/admin/DoctorForm";
import { HospitalForm } from "@/components/admin/HospitalForm";
import { TreatmentCostForm } from "@/components/admin/TreatmentCostForm";
import { CRMStats } from "@/components/admin/crm/CRMStats";
import { CaseList } from "@/components/admin/crm/CaseList";
import { CaseForm } from "@/components/admin/crm/CaseForm";
import { CaseDetails } from "@/components/admin/crm/CaseDetails";
import CrmUserManagement from "@/components/admin/CrmUserManagement";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Navbar from "@/components/Navbar";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [treatmentCosts, setTreatmentCosts] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("crm");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEnquiries: 0,
    pendingEnquiries: 0,
    confirmedEnquiries: 0,
    completedEnquiries: 0,
    totalConsultations: 0,
    totalDoctors: 0,
    pendingDoctors: 0,
    totalHospitals: 0,
    pendingHospitals: 0
  });

  // Dialog states
  const [doctorFormOpen, setDoctorFormOpen] = useState(false);
  const [hospitalFormOpen, setHospitalFormOpen] = useState(false);
  const [treatmentFormOpen, setTreatmentFormOpen] = useState(false);
  const [caseFormOpen, setCaseFormOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string }>({
    open: false,
    type: "",
    id: "",
  });

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      toast.error("Please log in to access admin dashboard");
      navigate("/admin-login");
      return;
    }

    // For now the existing admin role is the Super Admin role. Operational roles
    // are stored for later rollout but cannot enter this dashboard yet.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("roles")
      .eq("user_id", session.user.id)
      .eq("roles", "super_admin")
      .maybeSingle();

    if (!roles) {
      toast.error("Only the Super Admin can access this dashboard.");
      await supabase.auth.signOut();
      navigate("/admin-login");
      return;
    }

    setUser(session.user);
    setCurrentRole("super_admin");
    await loadAdminData();
    setLoading(false);
  };

  const loadAdminData = async () => {
    // Load all enquiries
    const { data: enquiriesData } = await supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false });

    if (enquiriesData) setEnquiries(enquiriesData);

    // Load all consultations
    const { data: consultationsData } = await supabase
      .from("consultations")
      .select(`
        *,
        doctor:doctors(name, specialty),
        user:profiles(full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (consultationsData) setConsultations(consultationsData);

    // Load treatment costs
    const { data: costsData } = await supabase
      .from("treatment_costs")
      .select("*")
      .order("treatment_name");

    if (costsData) setTreatmentCosts(costsData);

    // Load doctors
    const { data: doctorsData } = await supabase
      .from("doctors")
      .select(`
        *,
        hospital:hospitals(name)
      `)
      .order("name");

    if (doctorsData) setDoctors(doctorsData);

    // Load hospitals
    const { data: hospitalsData } = await supabase
      .from("hospitals")
      .select("*")
      .order("name");

    if (hospitalsData) setHospitals(hospitalsData);

    // Load Medical Cases (CRM)
    const { data: casesData } = await supabase
      .from("medical_cases")
      .select(`
        *,
        patient:profiles(*)
      `)
      .order("updated_at", { ascending: false });

    if (casesData) setCases(casesData);

    // Load Chat Messages
    const { data: chatData } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (chatData) setChatMessages(chatData);

    // Load user count
    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: 'exact', head: true });

    // Calculate stats
    if (enquiriesData) {
      setStats({
        totalUsers: userCount || 0,
        totalEnquiries: enquiriesData.length,
        pendingEnquiries: enquiriesData.filter(a => a.status === "pending").length,
        confirmedEnquiries: enquiriesData.filter(a => a.status === "confirmed").length,
        completedEnquiries: enquiriesData.filter(a => a.status === "completed").length,
        totalConsultations: consultationsData?.length || 0,
        totalDoctors: doctorsData?.length || 0,
        pendingDoctors: doctorsData?.filter(d => d.is_active === false).length || 0,
        totalHospitals: hospitalsData?.length || 0,
        pendingHospitals: hospitalsData?.filter(h => h.is_active === false).length || 0
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const updateEnquiryStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update enquiry");
    } else {
      toast.success("Enquiry updated");
      loadAdminData();
    }
  };

  const updateConsultationStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("consultations")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update consultation");
    } else {
      toast.success("Consultation updated");
      loadAdminData();
    }
  };

  const handleDelete = async () => {
    const { type, id } = deleteDialog;
    const table = type === "doctor" ? "doctors" : type === "hospital" ? "hospitals" : "treatment_costs";

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      toast.error(`Failed to delete ${type}`);
    } else {
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
      loadAdminData();
    }

    setDeleteDialog({ open: false, type: "", id: "" });
  };

  const openEditDoctor = (doctor: any) => {
    setSelectedDoctor(doctor);
    setDoctorFormOpen(true);
  };

  const openEditHospital = (hospital: any) => {
    setSelectedHospital(hospital);
    setHospitalFormOpen(true);
  };

  const openEditTreatment = (treatment: any) => {
    setSelectedTreatment(treatment);
    setTreatmentFormOpen(true);
  };

  const openAddDoctor = () => {
    setSelectedDoctor(null);
    setDoctorFormOpen(true);
  };

  const openAddHospital = () => {
    setSelectedHospital(null);
    setHospitalFormOpen(true);
  };

  const openAddTreatment = () => {
    setSelectedTreatment(null);
    setTreatmentFormOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navbar />

      <main className="container py-8 pt-24">
        <div className="relative h-48 mb-8 rounded-xl overflow-hidden shadow-lg border border-primary/10">
          <img
            src="https://images.unsplash.com/photo-1576091160550-217359f4ecf8?q=80&w=1200&auto=format&fit=crop"
            alt="Medical Hero"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-transparent flex flex-col justify-center px-8 text-white">
            <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
            <p className="text-primary-foreground/80 mt-1 max-w-md">
              Managing world-class medical tourism experiences.
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage users, inquiries, content, and monitor analytics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered users</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medical Enquiries</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEnquiries}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.pendingEnquiries} pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consultations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConsultations}</div>
              <p className="text-xs text-muted-foreground mt-1">Total bookings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Content</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDoctors + stats.totalHospitals}</div>
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-xs text-muted-foreground">{stats.totalDoctors} doctors, {stats.totalHospitals} hospitals</p>
                {(stats.pendingDoctors > 0 || stats.pendingHospitals > 0) && (
                  <p className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-sm self-start">
                    {stats.pendingDoctors + stats.pendingHospitals} Pending Review
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>



        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="crm">
              <Users className="w-4 h-4 mr-2" />
              CRM & Cases
            </TabsTrigger>
            <TabsTrigger value="inquiries">
              <Calendar className="w-4 h-4 mr-2" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="content">
              <Stethoscope className="w-4 h-4 mr-2" />
              Content Management
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="w-4 h-4 mr-2" />
              Live Chat
            </TabsTrigger>
            {(currentRole === "super_admin") && (
              <TabsTrigger value="users">
                <Users className="w-4 h-4 mr-2" />
                CRM Users & Roles
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="crm" className="space-y-4">
            {selectedCaseId ? (
              <CaseDetails
                caseId={selectedCaseId}
                onBack={() => {
                  setSelectedCaseId(null);
                  loadAdminData();
                }}
              />
            ) : (
              <>
                <CRMStats cases={cases} />
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Active Cases</h2>
                  <Button onClick={() => setCaseFormOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Case
                  </Button>
                </div>
                <CaseList
                  cases={cases}
                  onViewCase={setSelectedCaseId}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="inquiries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Medical Enquiries</CardTitle>
                <CardDescription>Manage user medical enquiries</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enquiries.map((enquiry) => (
                      <TableRow key={enquiry.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{enquiry.full_name}</p>
                            <p className="text-sm text-muted-foreground">{enquiry.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{enquiry.treatment_type}</TableCell>
                        <TableCell>{new Date(enquiry.preferred_date).toLocaleDateString()}</TableCell>
                        <TableCell>{enquiry.country}</TableCell>
                        <TableCell>
                          <Badge variant={
                            enquiry.status === "completed" ? "default" :
                              enquiry.status === "confirmed" ? "secondary" :
                                "outline"
                          }>
                            {enquiry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {enquiry.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => updateEnquiryStatus(enquiry.id, "confirmed")}
                              >
                                Confirm
                              </Button>
                            )}
                            {enquiry.status === "confirmed" && (
                              <Button
                                size="sm"
                                onClick={() => updateEnquiryStatus(enquiry.id, "completed")}
                              >
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Consultations</CardTitle>
                <CardDescription>Manage doctor consultation bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consultations.map((consultation) => (
                      <TableRow key={consultation.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{consultation.user?.full_name || "N/A"}</p>
                            <p className="text-sm text-muted-foreground">{consultation.user?.email || "N/A"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{consultation.doctor?.name || "N/A"}</p>
                            <p className="text-sm text-muted-foreground">{consultation.doctor?.specialty || "N/A"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{consultation.consultation_type}</TableCell>
                        <TableCell>{new Date(consultation.scheduled_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={
                            consultation.status === "completed" ? "default" :
                              consultation.status === "confirmed" ? "secondary" :
                                consultation.status === "cancelled" ? "destructive" :
                                  "outline"
                          }>
                            {consultation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {consultation.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => updateConsultationStatus(consultation.id, "confirmed")}
                              >
                                Confirm
                              </Button>
                            )}
                            {consultation.status === "confirmed" && (
                              <Button
                                size="sm"
                                onClick={() => updateConsultationStatus(consultation.id, "completed")}
                              >
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Doctors</CardTitle>
                  <CardDescription>View and manage doctor profiles</CardDescription>
                </div>
                <Button onClick={openAddDoctor}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Doctor
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Consultation Fee</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map((doctor) => (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.specialty}</TableCell>
                        <TableCell>{doctor.hospital?.name || "N/A"}</TableCell>
                        <TableCell>{doctor.experience_years ? `${doctor.experience_years} years` : "N/A"}</TableCell>
                        <TableCell>${doctor.consultation_fee || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDoctor(doctor)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteDialog({ open: true, type: "doctor", id: doctor.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Hospitals</CardTitle>
                  <CardDescription>View and manage hospital listings</CardDescription>
                </div>
                <Button onClick={openAddHospital}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Hospital
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Accreditation</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hospitals.map((hospital) => (
                      <TableRow key={hospital.id}>
                        <TableCell className="font-medium">{hospital.name}</TableCell>
                        <TableCell>{hospital.city}</TableCell>
                        <TableCell>{hospital.accreditation || "N/A"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{hospital.contact_email || "N/A"}</p>
                            <p className="text-muted-foreground">{hospital.contact_phone || "N/A"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditHospital(hospital)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteDialog({ open: true, type: "hospital", id: hospital.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Treatment Costs</CardTitle>
                  <CardDescription>View and manage treatment pricing</CardDescription>
                </div>
                <Button onClick={openAddTreatment}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Treatment
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treatment Name</TableHead>
                      <TableHead>Base Cost</TableHead>
                      <TableHead>Duration (Days)</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatmentCosts.map((treatment) => (
                      <TableRow key={treatment.id}>
                        <TableCell className="font-medium">{treatment.treatment_name}</TableCell>
                        <TableCell>${treatment.base_cost}</TableCell>
                        <TableCell>{treatment.duration_days || "N/A"}</TableCell>
                        <TableCell className="max-w-md truncate">{treatment.description || "No description"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditTreatment(treatment)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteDialog({ open: true, type: "treatment", id: treatment.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Enquiry Statistics</CardTitle>
                  <CardDescription>Overview of enquiry status distribution</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Pending</span>
                      <span className="text-sm font-medium">{stats.pendingEnquiries} ({stats.totalEnquiries > 0 ? Math.round((stats.pendingEnquiries / stats.totalEnquiries) * 100) : 0}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: `${stats.totalEnquiries > 0 ? (stats.pendingEnquiries / stats.totalEnquiries) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Confirmed</span>
                      <span className="text-sm font-medium">{stats.confirmedEnquiries} ({stats.totalEnquiries > 0 ? Math.round((stats.confirmedEnquiries / stats.totalEnquiries) * 100) : 0}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${stats.totalEnquiries > 0 ? (stats.confirmedEnquiries / stats.totalEnquiries) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Completed</span>
                      <span className="text-sm font-medium">{stats.completedEnquiries} ({stats.totalEnquiries > 0 ? Math.round((stats.completedEnquiries / stats.totalEnquiries) * 100) : 0}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${stats.totalEnquiries > 0 ? (stats.completedEnquiries / stats.totalEnquiries) * 100 : 0}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Overview</CardTitle>
                  <CardDescription>Key metrics and insights</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Total Users</span>
                    </div>
                    <span className="text-2xl font-bold">{stats.totalUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Active Doctors</span>
                    </div>
                    <span className="text-2xl font-bold">{stats.totalDoctors}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Partner Hospitals</span>
                    </div>
                    <span className="text-2xl font-bold">{stats.totalHospitals}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Treatment Options</span>
                    </div>
                    <span className="text-2xl font-bold">{treatmentCosts.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="chat">
            <Card>
              <CardHeader>
                <CardTitle>Live Chat History</CardTitle>
                <CardDescription>Real-time monitor of customer chat interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Session ID</TableHead>
                      <TableHead>Sender</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chatMessages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No chat messages found in the database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      chatMessages.map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell className="text-xs">
                            {new Date(msg.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-[10px]">
                            {msg.session_id.slice(0, 15)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant={msg.sender === 'user' ? 'default' : 'secondary'}>
                              {msg.sender}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md truncate text-sm">
                            {msg.text}
                          </TableCell>
                          <TableCell>
                            {!msg.is_read && msg.sender === 'user' ? (
                              <Badge variant="destructive">New</Badge>
                            ) : (
                              <Badge variant="outline">Read</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          {(currentRole === "super_admin") && (
            <TabsContent value="users" className="space-y-4">
              <CrmUserManagement />
            </TabsContent>
          )}
        </Tabs>
      </main >

      {/* Dialogs */}
      < DoctorForm
        open={doctorFormOpen}
        onOpenChange={setDoctorFormOpen}
        doctor={selectedDoctor}
        hospitals={hospitals}
        onSuccess={loadAdminData}
      />

      <HospitalForm
        open={hospitalFormOpen}
        onOpenChange={setHospitalFormOpen}
        hospital={selectedHospital}
        onSuccess={loadAdminData}
      />

      <TreatmentCostForm
        open={treatmentFormOpen}
        onOpenChange={setTreatmentFormOpen}
        treatment={selectedTreatment}
        onSuccess={loadAdminData}
      />

      <CaseForm
        open={caseFormOpen}
        onOpenChange={setCaseFormOpen}
        onSuccess={loadAdminData}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {deleteDialog.type}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
};

export default AdminDashboard;
