import React from 'react';

const createIcon = (paths) => (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {paths}
  </svg>
);

export const LayoutDashboard = createIcon(<React.Fragment><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></React.Fragment>);
export const Package = createIcon(<React.Fragment><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></React.Fragment>);
export const Tags = createIcon(<React.Fragment><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3v5.172a2 2 0 0 0 .586 1.414l8.293 8.293a2 2 0 0 0 2.828 0l2.828-2.828a2 2 0 0 0 0-2.828l-8.293-8.293Z"/><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/></React.Fragment>);
export const Truck = createIcon(<React.Fragment><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></React.Fragment>);
export const ArrowDownToLine = createIcon(<React.Fragment><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></React.Fragment>);
export const ArrowUpFromLine = createIcon(<React.Fragment><path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/></React.Fragment>);
export const Undo = createIcon(<React.Fragment><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></React.Fragment>);
export const Users = createIcon(<React.Fragment><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></React.Fragment>);
export const Briefcase = createIcon(<React.Fragment><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></React.Fragment>);
export const Factory = createIcon(<React.Fragment><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></React.Fragment>);
export const ClipboardList = createIcon(<React.Fragment><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></React.Fragment>);
export const Search = createIcon(<React.Fragment><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></React.Fragment>);
export const Download = createIcon(<React.Fragment><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></React.Fragment>);
export const Printer = createIcon(<React.Fragment><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect width="12" height="8" x="6" y="14" rx="1"/></React.Fragment>);
export const FileText = createIcon(<React.Fragment><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></React.Fragment>);
export const FileSpreadsheet = createIcon(<React.Fragment><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></React.Fragment>);
export const Plus = createIcon(<React.Fragment><path d="M5 12h14"/><path d="M12 5v14"/></React.Fragment>);
export const X = createIcon(<React.Fragment><path d="M18 6 6 18"/><path d="m6 6 12 12"/></React.Fragment>);
export const Menu = createIcon(<React.Fragment><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></React.Fragment>);
export const LogOut = createIcon(<React.Fragment><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></React.Fragment>);
export const Lock = createIcon(<React.Fragment><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></React.Fragment>);
export const User = createIcon(<React.Fragment><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></React.Fragment>);
export const Edit = createIcon(<React.Fragment><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></React.Fragment>);
export const Trash2 = createIcon(<React.Fragment><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></React.Fragment>);
export const MapPin = createIcon(<React.Fragment><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></React.Fragment>);
export const Play = createIcon(<React.Fragment><polygon points="5 3 19 12 5 21 5 3"/></React.Fragment>);
export const Save = createIcon(<React.Fragment><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></React.Fragment>);

// New Icons for Redesign
export const Bell = createIcon(<React.Fragment><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></React.Fragment>);
export const Calendar = createIcon(<React.Fragment><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></React.Fragment>);
export const ChevronDown = createIcon(<React.Fragment><path d="m6 9 6 6 6-6"/></React.Fragment>);
export const ChevronRight = createIcon(<React.Fragment><path d="m9 18 6-6-6-6"/></React.Fragment>);
export const UserCircle = createIcon(<React.Fragment><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></React.Fragment>);
export const CheckCircle2 = createIcon(<React.Fragment><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></React.Fragment>);
export const Loader2 = createIcon(<React.Fragment><path d="M21 12a9 9 0 1 1-6.219-8.56"/></React.Fragment>);
export const ArrowRight = createIcon(<React.Fragment><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></React.Fragment>);
export const Sun = createIcon(<React.Fragment><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></React.Fragment>);
export const Moon = createIcon(<React.Fragment><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></React.Fragment>);
export const Sparkles = createIcon(<React.Fragment><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></React.Fragment>);
export const Send = createIcon(<React.Fragment><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></React.Fragment>);
export const MessageSquare = createIcon(<React.Fragment><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></React.Fragment>);