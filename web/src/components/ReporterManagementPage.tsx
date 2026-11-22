import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Sliders,
  Smartphone,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { StarReporterPosterModal } from './StarReporterPoster';
import AppInstallsPage from './AppInstallsPage';
import ReporterAutomationPanel from './ReporterAutomationPanel';
import { useReporterManagement } from './reporter-management/useReporterManagement';
import ReporterApplicationsTab from './reporter-management/ReporterApplicationsTab';
import ActiveReportersTab from './reporter-management/ActiveReportersTab';
import FormerReportersTab from './reporter-management/FormerReportersTab';
import ReporterDetailDrawer from './reporter-management/ReporterDetailDrawer';
import {
  ApplicationApprovalModal,
  ConfirmActionModal,
  LocationEditModal,
  ReinstateReporterModal,
} from './reporter-management/ReporterModals';
import {
  ConfirmModalConfig,
  FormerReporter,
  ReporterApplication,
  ReporterTab,
  ReporterWithCounts,
} from './reporter-management/types';
import { ROLE_LABELS_TE } from '../utils/reporterManagementHelpers';

export type { ReporterWithCounts };

interface ReporterManagementPageProps {
  currentUser: User;
  onOpenReporterChat?: (reporterId: string) => void;
}

const ReporterManagementPage: React.FC<ReporterManagementPageProps> = ({
  currentUser,
  onOpenReporterChat,
}) => {
  const vm = useReporterManagement(currentUser);

  // Modal & Drawer UI State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);
  const [approvingApp, setApprovingApp] = useState<ReporterApplication | null>(null);
  const [editingLocationReporter, setEditingLocationReporter] = useState<ReporterWithCounts | null>(
    null
  );
  const [reinstatingFormer, setReinstatingFormer] = useState<FormerReporter | null>(null);
  const [posterModalUser, setPosterModalUser] = useState<ReporterWithCounts | null>(null);
  const [drawerReporterId, setDrawerReporterId] = useState<string | null>(null);

  const selectedDrawerReporter = useMemo(
    () => (drawerReporterId ? vm.reporters.find((r) => r.id === drawerReporterId) || null : null),
    [drawerReporterId, vm.reporters]
  );

  const handleOpenDrawer = (reporter: ReporterWithCounts) => {
    setDrawerReporterId(reporter.id);
    vm.loadReporterDrawerDetails(reporter.id, false);
  };

  const handleRejectAppRequest = (app: ReporterApplication) => {
    setConfirmModal({
      title: 'దరఖాస్తు తిరస్కరణ',
      description: `మీరు ఖచ్చితంగా "${app.name || 'ఈ దరఖాస్తుదారు'}" దరఖాస్తును తిరస్కరించాలనుకుంటున్నారా?`,
      confirmLabel: 'తిరస్కరించు',
      tone: 'warning',
      onConfirm: () => vm.rejectApplication(app),
    });
  };

  const handleDeleteAppRequest = (app: ReporterApplication) => {
    setConfirmModal({
      title: 'దరఖాస్తు శాశ్వత తొలగింపు',
      description: `"${app.name || 'ఈ దరఖాస్తు'}" రికార్డును శాశ్వతంగా తొలగించాలా? ఈ చర్యను వెనక్కి తీసుకోలేరు.`,
      confirmLabel: 'తొలగించు',
      tone: 'danger',
      onConfirm: () => vm.deleteApplication(app),
    });
  };

  const handleRoleChangeRequest = (reporter: ReporterWithCounts, nextRole: UserRole) => {
    const nextLabel = ROLE_LABELS_TE[nextRole] || nextRole;
    setConfirmModal({
      title: 'రిపోర్టర్ హోదా మార్పు',
      description: `"${reporter.name}" గారి హోదాను "${nextLabel}" గా మార్చాలనుకుంటున్నారా?`,
      confirmLabel: 'హోదా మార్చు',
      tone: 'primary',
      onConfirm: () => vm.updateReporterRole(reporter, nextRole),
    });
  };

  const handleDowngradeRequest = (reporter: ReporterWithCounts) => {
    setConfirmModal({
      title: 'రిపోర్టర్ హోదా తొలగింపు',
      description: `"${reporter.name}" గారిని రిపోర్టర్ హోదా నుండి తొలగించి సాధారణ సబ్‌స్క్రైబర్‌గా మార్చాలా? వీరు మాజీ రిపోర్టర్ల ట్యాబ్‌లో కనిపిస్తారు.`,
      confirmLabel: 'హోదా తొలగించు',
      tone: 'warning',
      requireReason: true,
      reasonLabel: 'తొలగింపు కారణం (ఐచ్ఛికం)',
      reasonPlaceholder: 'ఉదా: 10+ రోజుల నిష్క్రియాత్మకత / వ్యక్తిగత విరామం',
      onConfirm: async (reason) => {
        const ok = await vm.downgradeReporter(reporter, reason);
        if (ok && drawerReporterId === reporter.id) {
          setDrawerReporterId(null);
        }
      },
    });
  };

  const handleDeleteReporterRequest = (target: { id: string; name?: string }) => {
    setConfirmModal({
      title: 'ఖాతా శాశ్వత తొలగింపు',
      description: `"${target.name || 'ఈ రిపోర్టర్'}" ఖాతా మరియు సంబంధిత దరఖాస్తును శాశ్వతంగా తొలగించాలా? ఈ చర్యను వెనక్కి తీసుకోలేరు.`,
      confirmLabel: 'శాశ్వతంగా తొలగించు',
      tone: 'danger',
      onConfirm: async () => {
        const ok = await vm.deleteReporterPermanently(target.id, target.name || 'Reporter');
        if (ok && drawerReporterId === target.id) {
          setDrawerReporterId(null);
        }
      },
    });
  };

  const tabs: Array<{
    id: ReporterTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'applications',
      label: 'దరఖాస్తులు',
      count: vm.pendingAppsCount,
      icon: <ClipboardList size={15} />,
    },
    {
      id: 'reporters',
      label: 'యాక్టివ్ రిపోర్టర్లు',
      count: vm.reporters.length,
      icon: <UserCheck size={15} />,
    },
    {
      id: 'former',
      label: 'మాజీ రిపోర్టర్లు',
      count: vm.formerLoaded || vm.formerReporters.length > 0 ? vm.formerReporters.length : undefined,
      icon: <UserX size={15} />,
    },
    {
      id: 'automation',
      label: 'పుష్ రిమైండర్లు',
      icon: <Sliders size={15} />,
    },
    {
      id: 'installs',
      label: 'యాప్ ఇన్‌స్టాల్స్',
      count: vm.totalReferralInstalls,
      icon: <Smartphone size={15} />,
    },
  ];

  return (
    <div className="w-full font-mallanna text-slate-900 pb-16 space-y-5">
      {/* Inline Status Toast */}
      {vm.toast && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-semibold ${
            vm.toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : vm.toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-teal-50 border-teal-200 text-teal-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {vm.toast.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0" />
            )}
            <span>{vm.toast.text}</span>
          </div>
          <button
            type="button"
            onClick={vm.dismissToast}
            className="text-xs font-bold opacity-75 hover:opacity-100 px-2 py-0.5 whitespace-nowrap"
          >
            మూసివేయి
          </button>
        </div>
      )}

      {/* Recoverable Error Banner */}
      {vm.loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-rose-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{vm.loadError}</span>
          </div>
          <button
            type="button"
            onClick={vm.loadWorkspace}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors whitespace-nowrap"
          >
            మళ్లీ ప్రయత్నించు
          </button>
        </div>
      )}

      {/* Editorial Operations Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-ramabhadra text-slate-900 leading-tight">
                రిపోర్టర్ల నిర్వహణ & ట్రాకింగ్
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                దరఖాస్తులు · రియల్-టైమ్ వార్తల లెక్క · 3/7/10 రోజుల పుష్ రిమైండర్లు · మాజీ రిపోర్టర్ల ఆర్కైవ్
              </p>
            </div>
          </div>

          {/* Admin Sync & Refresh Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={vm.loadWorkspace}
              disabled={vm.loadingWorkspace}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
              title="అన్ని వివరాలు రిఫ్రెష్ చేయండి"
            >
              <RefreshCw size={14} className={vm.loadingWorkspace ? 'animate-spin' : ''} />
              <span>రిఫ్రెష్</span>
            </button>

            {currentUser.role === UserRole.ADMIN && (
              <>
                <button
                  type="button"
                  onClick={vm.syncActivityStats}
                  disabled={vm.isSyncingStats}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="అప్రూవ్ అయిన అన్ని వార్తల (క్రాస్-మండల్ సహా) గణాంకాలను రిపోర్టర్ ప్రొఫైల్స్‌తో సింక్ చేయండి"
                >
                  <RefreshCw size={14} className={vm.isSyncingStats ? 'animate-spin' : ''} />
                  <span>{vm.isSyncingStats ? 'సింక్ అవుతోంది...' : 'వార్తల గణాంకాలు సింక్'}</span>
                </button>
                <button
                  type="button"
                  onClick={vm.syncLeaderboardPoints}
                  disabled={vm.isSyncingLeaderboard}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="లీడర్‌బోర్డ్ పాయింట్లు రీ-క్యాలిక్యులేట్ చేయండి"
                >
                  <RefreshCw size={14} className={vm.isSyncingLeaderboard ? 'animate-spin' : ''} />
                  <span>{vm.isSyncingLeaderboard ? 'సింక్...' : 'పాయింట్ల సింక్'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Single-Line 5-Tab Workspace Navigation */}
        <div className="border-t border-slate-100 pt-3 flex items-center gap-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = vm.selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => vm.setSelectedTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`font-mono tabular-nums text-xs ${
                      isActive ? 'text-teal-100' : 'text-slate-400'
                    }`}
                  >
                    ({tab.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: APPLICATIONS */}
      {vm.selectedTab === 'applications' && (
        <ReporterApplicationsTab
          applications={vm.applications}
          occupiedMandalsMap={vm.occupiedMandalsMap}
          loading={vm.loadingApps}
          updatingIds={vm.updatingIds}
          onRefresh={vm.fetchApplications}
          onApproveClick={(app) => setApprovingApp(app)}
          onRejectClick={handleRejectAppRequest}
          onDeleteClick={handleDeleteAppRequest}
        />
      )}

      {/* TAB 2: ACTIVE REPORTERS */}
      {vm.selectedTab === 'reporters' && (
        <ActiveReportersTab
          reporters={vm.reporters}
          loading={vm.loadingReporters}
          updatingIds={vm.updatingIds}
          onSelectReporter={handleOpenDrawer}
          onEditLocation={(rep) => setEditingLocationReporter(rep)}
          onRoleChangeRequest={handleRoleChangeRequest}
          onToggleExemption={vm.toggleExemption}
          onOpenPoster={(rep) => setPosterModalUser(rep)}
          onDowngradeRequest={handleDowngradeRequest}
          onDeleteRequest={handleDeleteReporterRequest}
          onOpenDeskChat={onOpenReporterChat}
          onExportSuccess={(count) =>
            vm.showToast('success', `${count} మంది రిపోర్టర్ల CSV ఫైల్ విజయవంతంగా డౌన్‌లోడ్ అయింది.`)
          }
        />
      )}

      {/* TAB 3: FORMER / REMOVED REPORTERS */}
      {vm.selectedTab === 'former' && (
        <FormerReportersTab
          formerReporters={vm.formerReporters}
          loading={vm.loadingFormer}
          updatingIds={vm.updatingIds}
          onRefresh={vm.fetchFormerReporters}
          onReinstateClick={(former) => setReinstatingFormer(former)}
          onDeleteRequest={handleDeleteReporterRequest}
          onOpenDeskChat={onOpenReporterChat}
        />
      )}

      {/* TAB 4: PUSH REMINDER AUTOMATION */}
      {vm.selectedTab === 'automation' && (
        <ReporterAutomationPanel
          currentUser={currentUser}
          onConfigUpdated={vm.updateTrackingConfig}
          onScanCompleted={() => vm.fetchReporters()}
        />
      )}

      {/* TAB 5: APP INSTALLS */}
      {vm.selectedTab === 'installs' && <AppInstallsPage currentUser={currentUser} />}

      {/* SLIDE-OVER REPORTER PROFILE & HISTORY DRAWER */}
      <ReporterDetailDrawer
        reporter={selectedDrawerReporter}
        details={selectedDrawerReporter ? vm.drawerCache[selectedDrawerReporter.id] : undefined}
        loadingDetails={Boolean(selectedDrawerReporter && vm.loadingDrawerId === selectedDrawerReporter.id)}
        isBusy={Boolean(selectedDrawerReporter && vm.updatingIds[selectedDrawerReporter.id])}
        onClose={() => setDrawerReporterId(null)}
        onRefreshDetails={(id) => vm.loadReporterDrawerDetails(id, true)}
        onEditLocation={(rep) => setEditingLocationReporter(rep)}
        onToggleExemption={vm.toggleExemption}
        onOpenPoster={(rep) => setPosterModalUser(rep)}
        onDowngradeRequest={handleDowngradeRequest}
        onDeleteRequest={handleDeleteReporterRequest}
        onOpenDeskChat={onOpenReporterChat}
      />

      {/* IN-APP MODALS (ZERO NATIVE ALERT/CONFIRM) */}
      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />

      <ApplicationApprovalModal
        application={approvingApp}
        occupiedMandalsMap={vm.occupiedMandalsMap}
        submitting={Boolean(approvingApp && vm.updatingIds[approvingApp.id])}
        onClose={() => setApprovingApp(null)}
        onConfirm={(override) =>
          approvingApp ? vm.approveApplication(approvingApp, override) : Promise.resolve(false)
        }
      />

      <LocationEditModal
        reporter={editingLocationReporter}
        occupiedMandalsMap={vm.occupiedMandalsMap}
        submitting={Boolean(editingLocationReporter && vm.updatingIds[editingLocationReporter.id])}
        onClose={() => setEditingLocationReporter(null)}
        onSave={(district, mandal) =>
          editingLocationReporter
            ? vm.saveReporterLocation(editingLocationReporter, district, mandal)
            : Promise.resolve(false)
        }
      />

      <ReinstateReporterModal
        former={reinstatingFormer}
        occupiedMandalsMap={vm.occupiedMandalsMap}
        submitting={Boolean(reinstatingFormer && vm.updatingIds[reinstatingFormer.id])}
        onClose={() => setReinstatingFormer(null)}
        onConfirm={(assignment) =>
          reinstatingFormer
            ? vm.reinstateReporter(reinstatingFormer, assignment)
            : Promise.resolve(false)
        }
      />

      {/* STAR REPORTER POSTER MODAL */}
      {posterModalUser && (
        <StarReporterPosterModal
          data={{
            id: posterModalUser.id,
            name: posterModalUser.name || 'Reporter',
            photoUrl: posterModalUser.photoUrl,
            role: posterModalUser.role,
            district: posterModalUser.district,
            mandal: posterModalUser.assignedMandal || posterModalUser.mandal,
            points: posterModalUser.points ?? (posterModalUser.totalNewsCount || 0) * 10,
            totalStories: posterModalUser.totalNewsCount || 0,
          }}
          isModal={true}
          onClose={() => setPosterModalUser(null)}
        />
      )}
    </div>
  );
};

export default ReporterManagementPage;
