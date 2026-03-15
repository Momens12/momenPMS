import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  Filter,
  ArrowRight,
  Save,
  X,
  History,
  CalendarDays,
  CheckCircle,
  Edit3,
  BarChart3,
  ChevronDown,
  Download,
  Upload,
  Sparkles,
  Loader2,
  Building2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from "@google/genai";
import OpenAI from 'openai';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { Project, StatusUpdate, StageLog, Category } from './types';
import { PROJECT_STAGES, ProjectStage } from './constants';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'setups'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editingUpdate, setEditingUpdate] = useState<StatusUpdate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCorrecting, setIsCorrecting] = useState<string | null>(null);
  
  // Form states for AI correction
  const [newProjectName, setNewProjectName] = useState('');
  const [newStatusNote, setNewStatusNote] = useState('');
  
  // Detail edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingCat, setIsEditingCat] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editCatValue, setEditCatValue] = useState('');

  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [detailTab, setDetailTab] = useState<'history' | 'plan' | 'logs'>('history');
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Project | 'last_update'; direction: 'asc' | 'desc' }>({ key: 'app_name', direction: 'asc' });
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(() => (localStorage.getItem('aiProvider') as 'gemini' | 'openai') || 'gemini');
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openaiKey') || '');

  const [modal, setModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    type: 'alert' | 'confirm';
  }>({ show: false, title: '', message: '', type: 'alert' });

  useEffect(() => {
    loadProjects();
    loadCategories();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
      if (selectedProject) {
        const updated = data.find((p: Project) => p.id === selectedProject.id);
        if (updated) {
          setSelectedProject(updated);
          setEditNameValue(updated.app_name);
          setEditCatValue(updated.category);
        }
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName }),
      });
      if (res.ok) {
        setNewCatName('');
        loadCategories();
      }
    } catch (err) {
      console.error('Failed to add category', err);
    }
  };

  const handleUpdateCat = async (id: number, fields: Partial<Category>) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        setEditingCatId(null);
        loadCategories();
      }
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };

  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const projectData = {
      category: formData.get('category'),
      app_name: newProjectName,
      current_status: PROJECT_STAGES[0],
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      if (res.ok) {
        setShowAddProject(false);
        setNewProjectName('');
        loadProjects();
      }
    } catch (err) {
      console.error('Failed to add project', err);
    }
  };

  const handleAddUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject) return;
    const formData = new FormData(e.currentTarget);
    const updateData = {
      project_id: selectedProject.id,
      status_date: formData.get('status_date'),
      note: newStatusNote,
    };

    try {
      const url = editingUpdate ? `/api/updates/${editingUpdate.id}` : '/api/updates';
      const method = editingUpdate ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (res.ok) {
        setShowAddUpdate(false);
        setEditingUpdate(null);
        setNewStatusNote('');
        loadProjects();
      }
    } catch (err) {
      console.error('Failed to save update', err);
    }
  };

  const handleUpdateProject = async (fields: Partial<Project>) => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        loadProjects();
      }
    } catch (err) {
      console.error('Failed to update project', err);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.app_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = selectedStages.length === 0 || selectedStages.includes(p.current_status);
    return matchesSearch && matchesStage;
  });

  const stageData = PROJECT_STAGES.map(stage => ({
    name: stage,
    count: projects.filter(p => p.current_status === stage).length,
    color: '' // Will be set by getStageColor
  })).map(item => ({
    ...item,
    color: (() => {
      switch (item.name) {
        case "Analysis Session": return "#3B82F6";
        case "BRD Submission": return "#10B981";
        case "BRD Review & Sign-Off": return "#F59E0B";
        case "Pre Development Session": return "#06B6D4";
        case "Development": return "#6366F1";
        case "Demo": return "#A855F7";
        case "UAT": return "#1E40AF";
        case "Deployment": return "#64748B";
        case "Go live": return "#16A34A";
        default: return "#94A3B8";
      }
    })()
  }));

  const toggleStage = (stage: string) => {
    setSelectedStages(prev => 
      prev.includes(stage) 
        ? prev.filter(s => s !== stage) 
        : [...prev, stage]
    );
  };

  const handleSort = (key: keyof Project | 'last_update') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedProjects = [...projects]
    .filter(p => {
      const matchesSearch = p.app_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStage = selectedStages.length === 0 || selectedStages.includes(p.current_status);
      return matchesSearch && matchesStage;
    })
    .sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Project];
      let bValue: any = b[sortConfig.key as keyof Project];

      if (sortConfig.key === 'last_update') {
        aValue = a.updates[0]?.status_date || '';
        bValue = b.updates[0]?.status_date || '';
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleExportExcel = () => {
    // Get all unique dates from all updates across all projects
    const allDates = Array.from(new Set(
      projects.flatMap(p => p.updates.map(u => u.status_date))
    )).sort((a, b) => new Date(a as string).getTime() - new Date(b as string).getTime());

    const exportData = projects.map(p => {
      // Flatten project data for Excel
      const row: any = {
        'Category': p.category,
        'App Name': p.app_name,
        'Current Stage': p.current_status,
        'Analysis Session Date': p.analysis_session_date || 'N/A',
        'BRD Submission Date': p.brd_submission_date || 'N/A',
        'BRD Review Date': p.brd_review_date || 'N/A',
        'Dev Session Date': p.dev_session_date || 'N/A',
        'Development Start': p.development_start || 'N/A',
        'Development End': p.development_end || 'N/A',
        'Demo Start': p.demo_start || 'N/A',
        'Demo End': p.demo_end || 'N/A',
        'UAT Start': p.uat_start || 'N/A',
        'UAT End': p.uat_end || 'N/A',
        'Deployment Start': p.deployment_start || 'N/A',
        'Deployment End': p.deployment_end || 'N/A',
        'Go Live Start': p.go_live_start || 'N/A',
        'Go Live End': p.go_live_end || 'N/A',
      };

      // Add each status update to its specific date column
      allDates.forEach(date => {
        const update = p.updates.find(u => u.status_date === date);
        row[new Date(date as string).toLocaleDateString()] = update ? update.note : '';
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
    
    // Auto-size columns
    const maxWidths = Object.keys(exportData[0] || {}).map(key => {
      const headerLen = key.length;
      const maxDataLen = Math.max(...exportData.map((row: any) => String(row[key] || '').length));
      return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 50) };
    });
    worksheet['!cols'] = maxWidths;

    XLSX.writeFile(workbook, `Project_Status_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setModal({
          show: true,
          title: "Confirm Import",
          message: "This will delete all current data and replace it with the imported data. Are you sure?",
          type: 'confirm',
          onConfirm: async () => {
            setLoading(true);
            try {
              const res = await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
              });

              if (res.ok) {
                setModal({
                  show: true,
                  title: "Success",
                  message: "Data imported successfully!",
                  type: 'alert'
                });
                await Promise.all([loadProjects(), loadCategories()]);
              } else {
                const err = await res.json();
                setModal({
                  show: true,
                  title: "Import Failed",
                  message: err.error,
                  type: 'alert'
                });
              }
            } catch (err) {
              console.error("Import error", err);
              setModal({
                show: true,
                title: "Error",
                message: "Failed to import data.",
                type: 'alert'
              });
            } finally {
              setLoading(false);
            }
          }
        });
      } catch (err) {
        console.error("Import error", err);
        setModal({
          show: true,
          title: "Parse Error",
          message: "Failed to parse Excel file. Please ensure it matches the exported structure.",
          type: 'alert'
        });
      } finally {
        setLoading(false);
      }
      // Reset input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleFixGrammar = async (text: string, field: 'name' | 'note' | 'editName') => {
    if (!text.trim()) return;
    setIsCorrecting(field);
    try {
      let correctedText = '';
      if (aiProvider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Correct the grammar and professionalize the following text for a project management status report. Keep it concise. Return ONLY the corrected text: "${text}"`,
        });
        correctedText = response.text.trim().replace(/^"|"$/g, '');
      } else {
        if (!openaiKey) {
          setModal({ show: true, title: 'Missing API Key', message: 'Please configure your OpenAI API key in the Setups tab.', type: 'alert' });
          setIsCorrecting(null);
          return;
        }
        const openai = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: `Correct the grammar and professionalize the following text for a project management status report. Keep it concise. Return ONLY the corrected text: "${text}"` }],
          model: "gpt-3.5-turbo",
        });
        correctedText = completion.choices[0].message.content?.trim().replace(/^"|"$/g, '') || '';
      }
      
      if (field === 'name') setNewProjectName(correctedText);
      if (field === 'note') setNewStatusNote(correctedText);
      if (field === 'editName') setEditNameValue(correctedText);
    } catch (err) {
      console.error('AI correction failed', err);
      setModal({ show: true, title: 'AI Error', message: 'Failed to correct text. Please check your API key and connection.', type: 'alert' });
    } finally {
      setIsCorrecting(null);
    }
  };

  const getNextUpdateDate = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 2 = Tuesday, 4 = Thursday
    const next = new Date();
    
    if (day < 2) {
      next.setDate(now.getDate() + (2 - day));
    } else if (day < 4) {
      next.setDate(now.getDate() + (4 - day));
    } else {
      next.setDate(now.getDate() + (9 - day)); // Next Tuesday
    }
    return next.toLocaleDateString('en-GB');
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Analysis Session": return "bg-blue-500";
      case "BRD Submission": return "bg-emerald-500";
      case "BRD Review & Sign-Off": return "bg-amber-500";
      case "Pre Development Session": return "bg-cyan-500";
      case "Development": return "bg-indigo-500";
      case "Demo": return "bg-purple-500";
      case "UAT": return "bg-blue-800";
      case "Deployment": return "bg-slate-500";
      case "Go live": return "bg-green-600";
      default: return "bg-gray-400";
    }
  };

  const getCurrentStageDates = (project: Project) => {
    const stage = project.current_status;
    switch (stage) {
      case "Analysis Session": return { date: project.analysis_session_date };
      case "BRD Submission": return { date: project.brd_submission_date };
      case "BRD Review & Sign-Off": return { date: project.brd_review_date };
      case "Pre Development Session": return { date: project.dev_session_date };
      case "Development": return { start: project.development_start, end: project.development_end };
      case "Demo": return { start: project.demo_start, end: project.demo_end };
      case "UAT": return { start: project.uat_start, end: project.uat_end };
      case "Deployment": return { start: project.deployment_start, end: project.deployment_end };
      case "Go live": return { start: project.go_live_start, end: project.go_live_end };
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-[#E5E7EB] z-10">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <LayoutDashboard size={24} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">StatusFlow</h1>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('timeline')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'timeline' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <History size={18} />
              Timeline View
            </button>
            <button 
              onClick={() => setActiveTab('setups')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'setups' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Settings size={18} />
              Setups
            </button>
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 border-t border-[#E5E7EB]">
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <Clock size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Next Update Due</span>
            </div>
            <p className="text-sm font-medium text-amber-900">{getNextUpdateDate()}</p>
            <p className="text-[10px] text-amber-600 mt-1">Tuesday & Thursday Schedule</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {activeTab !== 'setups' && (
          <>
            <header className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Project Overview</h2>
                <p className="text-gray-500 text-sm">Automating Tuesday & Thursday status reports</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button 
                    onClick={() => setShowStageDropdown(!showStageDropdown)}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[180px] justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="text-gray-400" size={16} />
                      <span className="truncate max-w-[120px]">
                        {selectedStages.length === 0 ? 'All Stages' : 
                         selectedStages.length === 1 ? selectedStages[0] : 
                         `${selectedStages.length} Stages`}
                      </span>
                    </div>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${showStageDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showStageDropdown && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setShowStageDropdown(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2 overflow-hidden"
                        >
                          <div className="max-h-64 overflow-y-auto space-y-1">
                            <button 
                              onClick={() => { setSelectedStages([]); setShowStageDropdown(false); }}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              Clear All
                            </button>
                            {PROJECT_STAGES.map(stage => (
                              <label key={stage} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                                <input 
                                  type="checkbox"
                                  checked={selectedStages.includes(stage)}
                                  onChange={() => toggleStage(stage)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700">{stage}</span>
                              </label>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search projects..." 
                    className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleExportExcel}
                  className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                  title="Export all data to Excel"
                >
                  <Download size={18} />
                  Export
                </button>
                <button 
                  onClick={() => document.getElementById('import-excel')?.click()}
                  className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                  title="Import data from Excel"
                >
                  <Upload size={18} />
                  Import
                </button>
                <input 
                  id="import-excel"
                  type="file" 
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <button 
                  onClick={() => {
                    setNewProjectName('');
                    setShowAddProject(true);
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus size={18} />
                  New Project
                </button>
              </div>
            </header>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Stats Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="text-indigo-600" size={20} />
                      <h3 className="font-bold text-gray-900">Project Distribution by Stage</h3>
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total: {projects.length} Projects</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stageData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94A3B8' }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                        <Tooltip 
                          cursor={{ fill: '#F8FAFC' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar 
                          dataKey="count" 
                          radius={[4, 4, 0, 0]} 
                          barSize={40}
                          onClick={(data) => {
                            if (data && data.name) {
                              setSelectedStages([data.name]);
                            }
                          }}
                          className="cursor-pointer"
                        >
                          {stageData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.color}
                              fillOpacity={selectedStages.length === 0 || selectedStages.includes(entry.name) ? 1 : 0.3}
                            />
                          ))}
                          <LabelList dataKey="count" position="top" style={{ fill: '#64748B', fontSize: 12, fontWeight: 'bold' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                {activeTab === 'dashboard' ? (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap" onClick={() => handleSort('category')}>
                              <div className="flex items-center gap-2">
                                Category
                                {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronDown size={14} /> : <ChevronDown size={14} className="rotate-180" />)}
                              </div>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap min-w-[300px]" onClick={() => handleSort('app_name')}>
                              <div className="flex items-center gap-2">
                                Project Name
                                {sortConfig.key === 'app_name' && (sortConfig.direction === 'asc' ? <ChevronDown size={14} /> : <ChevronDown size={14} className="rotate-180" />)}
                              </div>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap" onClick={() => handleSort('current_status')}>
                              <div className="flex items-center gap-2">
                                Status
                                {sortConfig.key === 'current_status' && (sortConfig.direction === 'asc' ? <ChevronDown size={14} /> : <ChevronDown size={14} className="rotate-180" />)}
                              </div>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap min-w-[300px]" onClick={() => handleSort('last_update')}>
                              <div className="flex items-center gap-2">
                                Recent Update 1
                                {sortConfig.key === 'last_update' && (sortConfig.direction === 'asc' ? <ChevronDown size={14} /> : <ChevronDown size={14} className="rotate-180" />)}
                              </div>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[300px]">Recent Update 2</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sortedProjects.map((project) => (
                            <tr 
                              key={project.id} 
                              className="hover:bg-gray-50 transition-colors cursor-pointer group"
                              onClick={() => setSelectedProject(project)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase tracking-wide">
                                  {project.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap min-w-[300px]">{project.app_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${getStageColor(project.current_status)}`} />
                                  <span className="text-sm text-gray-600">{project.current_status}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap min-w-[300px]">
                                {project.updates[0] ? (
                                  <div className="max-w-[400px]">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{project.updates[0].status_date}</div>
                                    <div className="text-xs text-gray-600 truncate" title={project.updates[0].note}>{project.updates[0].note}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-300 italic">No updates</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap min-w-[300px]">
                                {project.updates[1] ? (
                                  <div className="max-w-[400px]">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{project.updates[1].status_date}</div>
                                    <div className="text-xs text-gray-600 truncate" title={project.updates[1].note}>{project.updates[1].note}</div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-300 italic">No updates</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  View Details <ChevronRight size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedProjects.map(project => {
                      const stageDates = getCurrentStageDates(project);
                      return (
                        <div key={project.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{project.category}</span>
                              <h3 className="font-bold text-lg mt-1">{project.app_name}</h3>
                            </div>
                            <History className="text-gray-300" size={20} />
                          </div>

                          {/* Current Stage Info */}
                          <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${getStageColor(project.current_status)}`} />
                              <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">Current Stage: {project.current_status}</span>
                            </div>
                            {stageDates && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                                {'date' in stageDates && stageDates.date && (
                                  <div className="flex items-center gap-1">
                                    <Calendar size={12} />
                                    <span>Date: {new Date(stageDates.date).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {'start' in stageDates && stageDates.start && (
                                  <div className="flex items-center gap-1">
                                    <Clock size={12} />
                                    <span>Start: {new Date(stageDates.start).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {'end' in stageDates && stageDates.end && (
                                  <div className="flex items-center gap-1">
                                    <ArrowRight size={12} />
                                    <span>End: {new Date(stageDates.end).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {(!('date' in stageDates && stageDates.date) && !('start' in stageDates && stageDates.start)) && (
                                  <span className="italic">No dates set for this stage</span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-4 flex-1 overflow-hidden">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status Logs</p>
                            <div className="max-h-48 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                              {project.updates.map((update, idx) => (
                                <div key={update.id} className="relative pl-6 pb-4 last:pb-0">
                                  {idx !== project.updates.length - 1 && (
                                    <div className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-100" />
                                  )}
                                  <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-indigo-500 bg-white" />
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(update.status_date).toLocaleDateString()}</p>
                                  <p className="text-sm text-gray-600 mt-1">{update.note}</p>
                                </div>
                              ))}
                              {project.updates.length === 0 && (
                                <p className="text-sm text-gray-400 italic">No status history yet.</p>
                              )}
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => setSelectedProject(project)}
                            className="w-full mt-6 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
                          >
                            FULL TIMELINE
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'setups' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Application Settings</h2>
                <p className="text-gray-500 text-sm">Manage categories and AI configuration</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Category Management */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Settings size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900">Category Management</h3>
                </div>
                
                <form onSubmit={handleAddCat} className="flex gap-2 mb-6">
                  <input 
                    type="text" 
                    placeholder="New category name..." 
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                    Add
                  </button>
                </form>

                <div className="space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group">
                      {editingCatId === cat.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <input 
                            type="text" 
                            className="flex-1 px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleUpdateCat(cat.id, { name: editCatName })} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded">
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingCatId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                          <button 
                            onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-all"
                          >
                            <Edit3 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Configuration */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900">AI Configuration</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">AI Provider</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { setAiProvider('gemini'); localStorage.setItem('aiProvider', 'gemini'); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${aiProvider === 'gemini' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        Google Gemini
                      </button>
                      <button 
                        onClick={() => { setAiProvider('openai'); localStorage.setItem('aiProvider', 'openai'); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${aiProvider === 'openai' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        OpenAI
                      </button>
                    </div>
                  </div>

                  {aiProvider === 'openai' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">OpenAI API Key</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          placeholder="sk-..." 
                          className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                        />
                        <button 
                          onClick={() => { localStorage.setItem('openaiKey', openaiKey); setModal({ show: true, title: 'Saved', message: 'OpenAI API key saved locally.', type: 'alert' }); }}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2">Key is stored in your browser's local storage.</p>
                    </motion.div>
                  )}

                  {aiProvider === 'gemini' && (
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-xs text-indigo-700 leading-relaxed">
                        Gemini is configured via server environment variables. No additional setup required.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Project Detail Modal */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-end">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-3xl h-full bg-white shadow-2xl p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setNewStatusNote('');
                      setEditingUpdate(null);
                      setShowAddUpdate(true);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Plus size={18} /> Add Status Note
                  </button>
                </div>
              </div>

              <div className="mb-8 space-y-4">
                <div className="group relative">
                  {isEditingCat ? (
                    <div className="flex items-center gap-2">
                      <select 
                        value={editCatValue}
                        onChange={(e) => setEditCatValue(e.target.value)}
                        className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {categories.filter(c => c.is_active).map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => {
                          handleUpdateProject({ category: editCatValue });
                          setIsEditingCat(false);
                        }}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Save size={14} />
                      </button>
                      <button onClick={() => setIsEditingCat(false)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-bold uppercase tracking-widest">
                        {selectedProject.category}
                      </span>
                      <button 
                        onClick={() => {
                          setEditCatValue(selectedProject.category);
                          setIsEditingCat(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-opacity"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="group relative">
                  {isEditingName ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input 
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="text-2xl font-bold w-full border-b-2 border-indigo-500 focus:outline-none"
                        />
                        <button 
                          onClick={() => handleFixGrammar(editNameValue, 'editName')}
                          disabled={isCorrecting === 'editName'}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Fix Grammar"
                        >
                          {isCorrecting === 'editName' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        </button>
                        <button 
                          onClick={() => {
                            handleUpdateProject({ app_name: editNameValue });
                            setIsEditingName(false);
                          }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                          <Save size={18} />
                        </button>
                        <button onClick={() => setIsEditingName(false)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-bold">{selectedProject.app_name}</h2>
                      <button 
                        onClick={() => {
                          setEditNameValue(selectedProject.app_name);
                          setIsEditingName(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-indigo-600 transition-opacity"
                      >
                        <Edit3 size={20} />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Current Process Stage</label>
                    <select 
                      value={selectedProject.current_status}
                      onChange={(e) => handleUpdateProject({ current_status: e.target.value })}
                      className="w-full bg-transparent font-bold text-gray-900 focus:outline-none"
                    >
                      {PROJECT_STAGES.map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${getStageColor(selectedProject.current_status)} shadow-sm`} />
                </div>
              </div>

              {/* Detail Tabs */}
              <div className="flex border-b border-gray-100 mb-8">
                <button 
                  onClick={() => setDetailTab('history')}
                  className={`px-6 py-3 text-sm font-bold transition-colors relative ${detailTab === 'history' ? 'text-indigo-600' : 'text-gray-400'}`}
                >
                  Status Notes
                  {detailTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
                <button 
                  onClick={() => setDetailTab('plan')}
                  className={`px-6 py-3 text-sm font-bold transition-colors relative ${detailTab === 'plan' ? 'text-indigo-600' : 'text-gray-400'}`}
                >
                  Full Plan
                  {detailTab === 'plan' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
                <button 
                  onClick={() => setDetailTab('logs')}
                  className={`px-6 py-3 text-sm font-bold transition-colors relative ${detailTab === 'logs' ? 'text-indigo-600' : 'text-gray-400'}`}
                >
                  Stage Logs
                  {detailTab === 'logs' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                </button>
              </div>

              {detailTab === 'history' && (
                <div className="space-y-8">
                  {selectedProject.updates.map((update, idx) => (
                    <div key={update.id} className="relative pl-8">
                      {idx !== selectedProject.updates.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-[-32px] w-px bg-gray-100" />
                      )}
                      <div className="absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white bg-indigo-600 shadow-sm" />
                      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm group/note">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {new Date(update.status_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </span>
                          <button 
                            onClick={() => {
                              setEditingUpdate(update);
                              setNewStatusNote(update.note);
                              setShowAddUpdate(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover/note:opacity-100"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{update.note}</p>
                      </div>
                    </div>
                  ))}
                  {selectedProject.updates.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <p className="text-gray-400">No status notes recorded yet.</p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'plan' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { label: "Analysis Session", key: "analysis_session_date", type: "single" },
                      { label: "BRD Submission", key: "brd_submission_date", type: "single" },
                      { label: "BRD Review & Sign-Off", key: "brd_review_date", type: "single" },
                      { label: "Pre Development Session", key: "dev_session_date", type: "single" },
                      { label: "Development", start: "development_start", end: "development_end", type: "range" },
                      { label: "Demo", start: "demo_start", end: "demo_end", type: "range" },
                      { label: "UAT", start: "uat_start", end: "uat_end", type: "range" },
                      { label: "Deployment", start: "deployment_start", end: "deployment_end", type: "range" },
                      { label: "Go live", start: "go_live_start", end: "go_live_end", type: "range" },
                    ].map((stage) => (
                      <div key={stage.label} className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-6">
                        <div className="w-48">
                          <p className="text-sm font-bold text-gray-900">{stage.label}</p>
                        </div>
                        
                        <div className="flex-1 flex gap-4">
                          {stage.type === 'single' ? (
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date</label>
                              <input 
                                type="date"
                                value={selectedProject[stage.key as keyof Project] as string || ''}
                                onChange={(e) => handleUpdateProject({ [stage.key!]: e.target.value })}
                                className="w-full bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none border border-transparent focus:border-indigo-500"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Start Date</label>
                                <input 
                                  type="date"
                                  value={selectedProject[stage.start as keyof Project] as string || ''}
                                  onChange={(e) => handleUpdateProject({ [stage.start!]: e.target.value })}
                                  className="w-full bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none border border-transparent focus:border-indigo-500"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">End Date</label>
                                <input 
                                  type="date"
                                  value={selectedProject[stage.end as keyof Project] as string || ''}
                                  onChange={(e) => handleUpdateProject({ [stage.end!]: e.target.value })}
                                  className="w-full bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none border border-transparent focus:border-indigo-500"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === 'logs' && (
                <div className="space-y-4">
                  {selectedProject.stageLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getStageColor(log.stage)}`} />
                        <span className="text-sm font-bold text-gray-900">{log.stage}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.changed_at).toLocaleString('en-GB', { 
                          day: 'numeric', month: 'short', year: 'numeric', 
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Project Modal */}
      <AnimatePresence>
        {showAddProject && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Add New Project</h2>
              <form onSubmit={handleAddProject} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase">App Name</label>
                    <button 
                      type="button"
                      onClick={() => handleFixGrammar(newProjectName, 'name')}
                      disabled={isCorrecting === 'name' || !newProjectName}
                      className="text-[10px] flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold disabled:opacity-50"
                    >
                      {isCorrecting === 'name' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      Fix Grammar
                    </button>
                  </div>
                  <input 
                    name="app_name"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="e.g. ATM Process Automation"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Category</label>
                  <select 
                    name="category"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Select Category</option>
                    {categories.filter(c => c.is_active).map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAddProject(false);
                      setNewProjectName('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Update Modal */}
      <AnimatePresence>
        {showAddUpdate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
            >
              <h2 className="text-2xl font-bold mb-6">{editingUpdate ? 'Edit Status Note' : 'New Status Note'}</h2>
              <form onSubmit={handleAddUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Date</label>
                  <input 
                    type="date"
                    name="status_date"
                    required
                    defaultValue={editingUpdate ? editingUpdate.status_date : new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Status Note</label>
                    <button 
                      type="button"
                      onClick={() => handleFixGrammar(newStatusNote, 'note')}
                      disabled={isCorrecting === 'note' || !newStatusNote}
                      className="text-[10px] flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold disabled:opacity-50"
                    >
                      {isCorrecting === 'note' ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      Fix Grammar
                    </button>
                  </div>
                  <textarea 
                    name="note"
                    required
                    rows={4}
                    value={newStatusNote}
                    onChange={(e) => setNewStatusNote(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    placeholder="Describe the current progress..."
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAddUpdate(false);
                      setEditingUpdate(null);
                      setNewStatusNote('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    {editingUpdate ? 'Update Note' : 'Save Note'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Modal */}
      <AnimatePresence>
        {modal.show && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${modal.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {modal.type === 'confirm' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{modal.title}</h3>
              </div>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">{modal.message}</p>
              <div className="flex gap-3">
                {modal.type === 'confirm' && (
                  <button 
                    onClick={() => setModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (modal.onConfirm) modal.onConfirm();
                    setModal(prev => ({ ...prev, show: false }));
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${modal.type === 'confirm' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {modal.type === 'confirm' ? 'Confirm' : 'OK'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
