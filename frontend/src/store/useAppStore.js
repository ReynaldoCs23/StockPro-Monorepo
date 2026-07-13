import { create } from 'zustand';

const useAppStore = create((set, get) => ({
    // Auth & Global App State
    currentUser: null,
    currentUserPermissions: [],
    isApiOffline: false,
    
    // Master Data & Inventory State
    categories: [],
    satuans: [],
    locations: [],
    suppliers: [],
    customers: [],
    items: [],
    inbound: [],
    outbound: [],
    returns: [],
    users: [],
    logs: [],
    companyProfile: {
        nama: 'PT Mara Jaya Dewi Sakti',
        alamat: '',
        npwp: '',
        penanggung_jawab: ''
    },

    // Actions
    setCurrentUser: (user) => set({ currentUser: user }),
    setCurrentUserPermissions: (permissions) => set({ currentUserPermissions: permissions }),
    setIsApiOffline: (isOffline) => set({ isApiOffline: isOffline }),
    
    setAllData: (data) => set((state) => ({
        users: data.users || state.users,
        categories: data.categories || state.categories,
        satuans: data.satuans || state.satuans,
        locations: data.locations || state.locations,
        suppliers: data.suppliers || state.suppliers,
        customers: data.customers || state.customers,
        items: data.items || state.items,
        inbound: data.inbound || state.inbound,
        outbound: data.outbound || state.outbound,
        returns: data.returns || state.returns,
        logs: data.logs || state.logs,
        companyProfile: data.companyProfile || state.companyProfile
    })),

    // Individual Setters (useful for specific page mutations)
    setItems: (items) => set({ items }),
    setCategories: (categories) => set({ categories }),
    setSatuans: (satuans) => set({ satuans }),
    setLocations: (locations) => set({ locations }),
    setSuppliers: (suppliers) => set({ suppliers }),
    setCustomers: (customers) => set({ customers }),
    setInbound: (inbound) => set({ inbound }),
    setOutbound: (outbound) => set({ outbound }),
    setReturns: (returns) => set({ returns }),
    setUsers: (users) => set({ users }),
    setCompanyProfile: (companyProfile) => set({ companyProfile }),
    
    addLog: (aksi, modul, ket) => set((state) => {
        const newLog = { 
            idLog: 'LOG-' + Date.now(), 
            waktu: new Date().toISOString(), 
            user: state.currentUser?.namaLengkap || 'Sistem', 
            aksi, 
            modul, 
            keterangan: ket 
        };
        return { logs: [newLog, ...state.logs] };
    }),
}));

export default useAppStore;
