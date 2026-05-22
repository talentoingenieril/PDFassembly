import React, { useState, useRef, ChangeEvent } from 'react';
import { Settings, FileText, Upload, Trash2, ArrowUp, ArrowDown, Play, Image as ImageIcon, Book, Target, AlignLeft, AlignCenter, AlignRight, Save } from 'lucide-react';
import { PDFFileItem, ProcessingSettings, MeasurementUnit, MarginSettings, FontType, Alignment } from './types';
import { processPDFs, downloadFile } from './lib/pdf';

type SidebarTab = 'global' | 'header' | 'footer';

const DEFAULTS: ProcessingSettings = {
  measurementUnit: 'cm',
  globalMargins: { top: 2, bottom: 1.25, left: 0, right: 0 },
  header: {
    useDefaultImages: true,
    marginTop: 0.25, sideMargin: 2, height: 1.5,
    leftImage: null, rightImage: null,
    centralTextWidthPercent: 60,
    titleText: 'Estudio Definitivo de Ingeniería (EDI) del proyecto "Creación de la Nueva Carretera Central"',
    textStyle: { font: 'Segoe UI-Bold', size: 12, color: '#2E3672', align: 'center' },
    frameStyle: { thickness: 0.1, color: '#000000', style: 'dotted' }
  },
  footer: {
    marginBottom: 0.1, sideMargin: 2, height: 0.9,
    leftWidthPercent: 80,
    staticText: 'CONSULTOR EDI | Nueva Carretera Central | 21 de mayo de 2026 | VIA-C08-001',
    staticTextStyle: { font: 'Segoe UI-Bold', size: 9, color: '#2E3672', align: 'left' },
    customTextStyle: { font: 'Segoe UI-Bold', size: 9, color: '#2E3672', align: 'left' },
    paginationStyle: { font: 'Segoe UI-Bold', size: 9, color: '#2E3672', align: 'right' },
    frameStyle: { thickness: 0.1, color: '#000000', style: 'dotted' }
  }
};

const FONTS: FontType[] = ['Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Times-Bold', 'Courier', 'Courier-Bold', 'Segoe UI', 'Segoe UI-Bold'];

export default function App() {
  const [files, setFiles] = useState<PDFFileItem[]>([]);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULTS);
  const [activeTab, setActiveTab] = useState<SidebarTab>('global');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        return {
          id: Math.random().toString(36).substr(2, 9),
          file: file,
          name: file.name,
          footerCustomText: nameWithoutExt.toUpperCase(),
          isCoversPdf: false,
          coverSettings: { useCover: false, coverPageStart: 1, coverPageEnd: 1 },
          applyWhiteBorders: true,
          useCustomMargins: false,
          margins: { ...settings.globalMargins },
          applyAnnotations: true
        } as PDFFileItem;
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateFile = (id: string, updates: Partial<PDFFileItem>) => {
    setFiles(prev => prev.map(f => {
       if (f.id !== id) {
           // Enforce only one CoversPdf
           if (updates.isCoversPdf && f.isCoversPdf) return { ...f, isCoversPdf: false };
           return f;
       }
       return { ...f, ...updates };
    }));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    try {
      await new Promise(r => setTimeout(r, 50));
      const result = await processPDFs(files, settings, setProgress);
      downloadFile(result, 'Documento_Final.pdf');
    } catch (e) {
      console.error(e);
      alert("Error procesando. Revisa la consola.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const imageUpload = (target: 'left' | 'right') => (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const res = ev.target?.result as string;
              if (target === 'left') setSettings({...settings, header: {...settings.header, leftImage: res}});
              else setSettings({...settings, header: {...settings.header, rightImage: res}});
          };
          reader.readAsDataURL(file);
      }
  };

  const setUnit = (u: MeasurementUnit) => setSettings({...settings, measurementUnit: u});

  const handleSaveSettings = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "configuracion_pdf.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLoadSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const loaded = JSON.parse(ev.target?.result as string);
          setSettings(loaded);
        } catch(err) {
          alert('Error al cargar archivo de configuración.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080A] text-gray-200 font-sans text-sm flex flex-col">
      <header className="h-12 shrink-0 border-b border-[#1A1F26] flex items-center justify-between px-4 bg-[#0A0D11]">
        <div className="flex items-center gap-2">
          <Book className="w-4 h-4 text-blue-500" />
          <h1 className="font-semibold text-gray-200 tracking-tight text-[13px] uppercase">PDFassembly by CFC v1.0</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-row bg-[#1A1F26] rounded overflow-hidden shadow-inner border border-gray-800">
            <label title="Cargar Configuración JSON" className="flex items-center justify-center cursor-pointer px-2.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800 border-r border-gray-700 transition">
               <Upload className="w-3 h-3" />
               <input type="file" accept=".json" className="hidden" onChange={handleLoadSettings} />
            </label>
            <button onClick={handleSaveSettings} title="Guardar Configuración JSON" className="px-2.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800 border-r border-gray-700 transition">
               <Save className="w-3 h-3" />
            </button>
            <button onClick={() => setUnit('cm')} className={`px-3 py-1.5 text-xs font-semibold ${settings.measurementUnit === 'cm' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>CM</button>
            <button onClick={() => setUnit('pt')} className={`px-3 py-1.5 text-xs font-semibold ${settings.measurementUnit === 'pt' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>PX</button>
          </div>
          <button onClick={handleProcess} disabled={isProcessing || !files.length} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1E232B] disabled:text-gray-500 text-white px-3 py-1.5 text-xs rounded font-medium transition-colors">
            {isProcessing ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
            Procesar Docs
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left dense sidebar */}
        <aside className="w-[340px] xl:w-[380px] bg-[#0A0D11] border-r border-[#1A1F26] flex flex-col hidden md:flex shrink-0">
          <div className="flex border-b border-[#1A1F26] bg-[#06080A]">
            <TabBtn active={activeTab==='global'} text="General" icon={<Settings className="w-3 h-3"/>} onClick={()=>setActiveTab('global')} />
            <TabBtn active={activeTab==='header'} text="Header" icon={<Target className="w-3 h-3"/>} onClick={()=>setActiveTab('header')} />
            <TabBtn active={activeTab==='footer'} text="Footer" icon={<AlignLeft className="w-3 h-3"/>} onClick={()=>setActiveTab('footer')} />
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {activeTab === 'global' && (
              <Section title={`Márgenes Globales de Limpieza (${settings.measurementUnit})`}>
                 <div className="grid grid-cols-2 gap-2">
                    <NumInput label="Arriba" value={settings.globalMargins.top} onChange={v => setSettings({...settings, globalMargins: {...settings.globalMargins, top: v}})} />
                    <NumInput label="Abajo" value={settings.globalMargins.bottom} onChange={v => setSettings({...settings, globalMargins: {...settings.globalMargins, bottom: v}})} />
                    <NumInput label="Izq" value={settings.globalMargins.left} onChange={v => setSettings({...settings, globalMargins: {...settings.globalMargins, left: v}})} />
                    <NumInput label="Der" value={settings.globalMargins.right} onChange={v => setSettings({...settings, globalMargins: {...settings.globalMargins, right: v}})} />
                 </div>
              </Section>
            )}

            {activeTab === 'header' && (
              <div className="space-y-4">
                 <Section title="Caja Header">
                    <div className="grid grid-cols-2 gap-2">
                      <NumInput label={`Top (${settings.measurementUnit})`} value={settings.header.marginTop} onChange={v=>setSettings({...settings,header:{...settings.header,marginTop:v}})} />
                      <NumInput label={`Altura (${settings.measurementUnit})`} value={settings.header.height} onChange={v=>setSettings({...settings,header:{...settings.header,height:v}})} />
                      <NumInput label={`Lateral (${settings.measurementUnit})`} value={settings.header.sideMargin} onChange={v=>setSettings({...settings,header:{...settings.header,sideMargin:v}})} />
                      <NumInput label="Ancho Central (%)" value={settings.header.centralTextWidthPercent} onChange={v=>setSettings({...settings,header:{...settings.header,centralTextWidthPercent:v}})} />
                    </div>
                 </Section>
                 <Section title="Imágenes">
                    <label className="flex items-center gap-1.5 mb-3 cursor-pointer text-gray-400 text-[11px] bg-black/20 p-2 rounded border border-gray-800">
                       <input type="checkbox" checked={settings.header.useDefaultImages} onChange={e=>setSettings({...settings,header:{...settings.header,useDefaultImages:e.target.checked}})} className="rounded bg-black border-gray-700 text-blue-500 focus:ring-0 w-3 h-3"/>
                       Usar imágenes por defecto
                    </label>
                    <div className={`flex gap-2 transition-opacity ${settings.header.useDefaultImages ? 'opacity-30 pointer-events-none' : ''}`}>
                        <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-700 bg-black/20 p-2 rounded cursor-pointer hover:border-blue-500 group">
                           {settings.header.leftImage ? <img src={settings.header.leftImage} className="h-6 object-contain"/> : <><ImageIcon className="w-4 h-4 text-gray-500 mb-1 group-hover:text-blue-500"/><span className="text-[10px] text-gray-500">Img. Izq</span></>}
                           <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={imageUpload('left')}/>
                        </label>
                        <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-700 bg-black/20 p-2 rounded cursor-pointer hover:border-blue-500 group">
                           {settings.header.rightImage ? <img src={settings.header.rightImage} className="h-6 object-contain"/> : <><ImageIcon className="w-4 h-4 text-gray-500 mb-1 group-hover:text-blue-500"/><span className="text-[10px] text-gray-500">Img. Der</span></>}
                           <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={imageUpload('right')}/>
                        </label>
                    </div>
                 </Section>
                 <Section title="Texto Central">
                    <input type="text" value={settings.header.titleText} onChange={e=>setSettings({...settings,header:{...settings.header,titleText:e.target.value}})} className="w-full bg-[#1A1F26] border border-gray-700 rounded px-2 py-1 text-xs outline-none mb-2"/>
                    <StyleControls 
                       style={settings.header.textStyle} 
                       onChange={s => setSettings({...settings,header:{...settings.header,textStyle:s}})} 
                    />
                 </Section>
                 <FrameControls style={settings.header.frameStyle} onChange={s=>setSettings({...settings,header:{...settings.header,frameStyle:s}})} />
              </div>
            )}

            {activeTab === 'footer' && (
              <div className="space-y-4">
                 <Section title="Caja Pie">
                    <div className="grid grid-cols-2 gap-2">
                      <NumInput label={`Bottom (${settings.measurementUnit})`} value={settings.footer.marginBottom} onChange={v=>setSettings({...settings,footer:{...settings.footer,marginBottom:v}})} />
                      <NumInput label={`Altura (${settings.measurementUnit})`} value={settings.footer.height} onChange={v=>setSettings({...settings,footer:{...settings.footer,height:v}})} />
                      <NumInput label={`Lateral (${settings.measurementUnit})`} value={settings.footer.sideMargin} onChange={v=>setSettings({...settings,footer:{...settings.footer,sideMargin:v}})} />
                      <NumInput label="Ancho Izq (%)" value={settings.footer.leftWidthPercent} onChange={v=>setSettings({...settings,footer:{...settings.footer,leftWidthPercent:v}})} />
                    </div>
                 </Section>
                 <Section title="Estatico Gral">
                    <input type="text" value={settings.footer.staticText} onChange={e=>setSettings({...settings,footer:{...settings.footer,staticText:e.target.value}})} className="w-full bg-[#1A1F26] border border-gray-700 rounded px-2 py-1 text-xs outline-none mb-2"/>
                    <StyleControls style={settings.footer.staticTextStyle} onChange={s => setSettings({...settings,footer:{...settings.footer,staticTextStyle:s}})} />
                 </Section>
                 <Section title="Estilo Título Per-Archivo">
                    <StyleControls style={settings.footer.customTextStyle} onChange={s => setSettings({...settings,footer:{...settings.footer,customTextStyle:s}})} hideAlign/>
                 </Section>
                 <Section title="Paginación (Der)">
                    <StyleControls style={settings.footer.paginationStyle} onChange={s => setSettings({...settings,footer:{...settings.footer,paginationStyle:s}})} />
                 </Section>
                 <FrameControls style={settings.footer.frameStyle} onChange={s=>setSettings({...settings,footer:{...settings.footer,frameStyle:s}})} />
              </div>
            )}
          </div>
        </aside>

        {/* Main files area */}
        <main className="flex-1 bg-[#06080A] flex flex-col">
           <div className="p-3 border-b border-[#1A1F26] flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Orden de Trabajo</span>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-[#1A1F26] hover:bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1 rounded flex items-center gap-1">
                <Upload className="w-3 h-3" /> Agregar
              </button>
              <input type="file" multiple accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileSelect}/>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600">
                   <FileText className="w-10 h-10 mb-2 opacity-50"/>
                   <span className="text-sm border border-dashed border-gray-700 p-2 rounded bg-black/20">Aún no hay PDFs cargados</span>
                </div>
              ) : (
                <div className="space-y-3">
                   {files.map((f, i) => (
                      <div key={f.id} className={`flex items-stretch bg-[#0A0D11] border ${f.isCoversPdf?'border-emerald-500/30':'border-[#1A1F26]'} rounded-md overflow-hidden text-xs shadow`}>
                         
                         <div className="flex flex-col bg-[#06080A] border-r border-[#1A1F26]">
                            <button onClick={()=> {const t=[...files]; [t[i-1],t[i]]=[t[i],t[i-1]]; setFiles(t)}} disabled={i===0} className="flex-1 px-1.5 text-gray-600 hover:text-white disabled:opacity-30"><ArrowUp className="w-3 h-3"/></button>
                            <span className="text-[10px] font-mono text-center py-1 bg-black/30 border-y border-[#1A1F26]">{i+1}</span>
                            <button onClick={()=> {const t=[...files]; [t[i+1],t[i]]=[t[i],t[i+1]]; setFiles(t)}} disabled={i===files.length-1} className="flex-1 px-1.5 text-gray-600 hover:text-white disabled:opacity-30"><ArrowDown className="w-3 h-3"/></button>
                         </div>

                         <div className="flex-1 p-3 flex flex-col gap-3">
                            <div className="flex items-start justify-between">
                               <div className="font-semibold text-gray-200 truncate flex items-center gap-2">
                                  {f.name}
                                  {f.isCoversPdf && <span className="bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded-[3px] text-[9px] uppercase border border-emerald-500/20">Dato de Portadas</span>}
                               </div>
                               <button onClick={() => setFiles(files.filter(x=>x.id!==f.id))} className="text-gray-500 hover:text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 border-t border-gray-800/50 pt-2 relative">
                               
                               <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-400 text-[11px]">
                                     <input type="checkbox" checked={f.applyWhiteBorders} onChange={e=>updateFile(f.id,{applyWhiteBorders:e.target.checked})} className="rounded bg-black border-gray-700 text-blue-500 focus:ring-0 w-3 h-3"/>
                                     Limpiar Bordes
                                  </label>
                                  {f.applyWhiteBorders && (
                                     <div className="ml-4 space-y-1">
                                        <label className="flex items-center gap-1 cursor-pointer text-gray-500 text-[10px]">
                                           <input type="checkbox" checked={f.useCustomMargins} onChange={e=>updateFile(f.id,{useCustomMargins:e.target.checked})} className="rounded-sm bg-black border-gray-700 text-blue-500 focus:ring-0 w-2.5 h-2.5"/>
                                           Márgenes Propios ({settings.measurementUnit})
                                        </label>
                                        {f.useCustomMargins && (
                                           <div className="grid grid-cols-4 gap-1 p-1 bg-black/20 rounded border border-gray-800">
                                              <div className="relative">
                                                 <span className="absolute inset-y-0 left-0.5 flex items-center pointer-events-none text-gray-600 text-[9px]">Arr</span>
                                                 <input type="number" step="0.1" value={f.margins.top} onChange={e=>updateFile(f.id,{margins:{...f.margins, top:Number(e.target.value)}})} className="bg-transparent border-b border-gray-700 text-right w-full focus:border-blue-500 outline-none text-[10px] pl-4 pr-1" title="Top"/>
                                              </div>
                                              <div className="relative">
                                                 <span className="absolute inset-y-0 left-0.5 flex items-center pointer-events-none text-gray-600 text-[9px]">Aba</span>
                                                 <input type="number" step="0.1" value={f.margins.bottom} onChange={e=>updateFile(f.id,{margins:{...f.margins, bottom:Number(e.target.value)}})} className="bg-transparent border-b border-gray-700 text-right w-full focus:border-blue-500 outline-none text-[10px] pl-4 pr-1" title="Bot"/>
                                              </div>
                                              <div className="relative">
                                                 <span className="absolute inset-y-0 left-0.5 flex items-center pointer-events-none text-gray-600 text-[9px]">Izq</span>
                                                 <input type="number" step="0.1" value={f.margins.left} onChange={e=>updateFile(f.id,{margins:{...f.margins, left:Number(e.target.value)}})} className="bg-transparent border-b border-gray-700 text-right w-full focus:border-blue-500 outline-none text-[10px] pl-4 pr-1" title="Izq"/>
                                              </div>
                                              <div className="relative">
                                                 <span className="absolute inset-y-0 left-0.5 flex items-center pointer-events-none text-gray-600 text-[9px]">Der</span>
                                                 <input type="number" step="0.1" value={f.margins.right} onChange={e=>updateFile(f.id,{margins:{...f.margins, right:Number(e.target.value)}})} className="bg-transparent border-b border-gray-700 text-right w-full focus:border-blue-500 outline-none text-[10px] pl-4 pr-1" title="Der"/>
                                              </div>
                                           </div>
                                        )}
                                     </div>
                                  )}
                               </div>

                               <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-400 text-[11px]">
                                     <input type="checkbox" checked={f.applyAnnotations} onChange={e=>updateFile(f.id,{applyAnnotations:e.target.checked})} className="rounded bg-black border-gray-700 text-blue-500 focus:ring-0 w-3 h-3"/>
                                     Anotar (Header/Footer)
                                  </label>
                                  {f.applyAnnotations && (
                                     <div className="ml-4 flex flex-col gap-1">
                                        <span className="text-[10px] text-gray-500">Texto Personalizado Pie:</span>
                                        <input type="text" value={f.footerCustomText} onChange={e=>updateFile(f.id,{footerCustomText:e.target.value})} className="bg-[#1A1F26] border border-gray-700 rounded px-2 py-0.5 outline-none text-blue-100 text-[10px] w-full"/>
                                     </div>
                                  )}
                               </div>

                               <div className="flex flex-col gap-1.5 p-1.5 bg-black/20 rounded border border-gray-800">
                                   <label className="flex items-center gap-1 cursor-pointer text-emerald-500/80 hover:text-emerald-400 text-[10px] font-semibold">
                                       <input type="checkbox" checked={f.isCoversPdf} onChange={e=>updateFile(f.id,{isCoversPdf:e.target.checked})} className="rounded-full bg-black border-gray-700 text-emerald-500 focus:ring-0 w-2.5 h-2.5"/>
                                       Es Documento de Portadas
                                   </label>
                                   <div className="border-t border-gray-800/50 mt-1 pt-1">
                                       <label className="flex items-center gap-1 cursor-pointer text-gray-400 text-[10px]">
                                           <input type="checkbox" checked={f.coverSettings.useCover} onChange={e=>updateFile(f.id,{coverSettings:{...f.coverSettings, useCover:e.target.checked}})} className="rounded-sm bg-black border-gray-700 text-blue-500 focus:ring-0 w-2.5 h-2.5"/>
                                           {f.isCoversPdf ? 'Portada Global (Rango)' : 'Insertar Portada (Rango)'}
                                       </label>
                                       {f.coverSettings.useCover && (
                                          <div className="ml-4 flex items-center gap-2 mt-1 -mb-1">
                                             <span className="text-[9px] text-gray-600">Págs:</span>
                                             <input type="number" min="1" value={f.coverSettings.coverPageStart} onChange={e=>updateFile(f.id,{coverSettings:{...f.coverSettings,coverPageStart:Number(e.target.value)}})} className="bg-transparent border-b border-gray-700 text-center w-8 focus:border-blue-500 outline-none text-[10px] text-gray-300"/>
                                             <span className="text-[9px] text-gray-600">a</span>
                                             <input type="number" min="1" value={f.coverSettings.coverPageEnd} onChange={e=>updateFile(f.id,{coverSettings:{...f.coverSettings,coverPageEnd:Number(e.target.value)}})} className="bg-transparent border-b border-gray-700 text-center w-8 focus:border-blue-500 outline-none text-[10px] text-gray-300"/>
                                          </div>
                                       )}
                                   </div>
                               </div>

                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              )}
           </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1A1F26; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2A313C; }
      `}</style>
    </div>
  );
}

const TabBtn = ({active, text, icon, onClick}:any) => (
  <button onClick={onClick} className={`flex-1 flex gap-1.5 items-center justify-center py-2 text-xs font-semibold border-b-2 transition-colors ${active?'border-blue-500 text-blue-400 bg-[#0A0D11]':'border-transparent text-gray-500 hover:text-gray-300'}`}>
    {icon} {text}
  </button>
);

const Section = ({title, children}:any) => (
  <div className="bg-[#12151A] rounded overflow-hidden border border-[#1A1F26] mb-3">
    <div className="bg-[#0A0D11] px-2 py-1.5 border-b border-[#1A1F26] text-[10px] font-bold uppercase tracking-widest flex items-center text-gray-400">{title}</div>
    <div className="p-2">{children}</div>
  </div>
);

const NumInput = ({label, value, onChange}:any) => (
  <div className="flex flex-col gap-0.5">
    <label className="text-[9px] text-gray-500">{label}</label>
    <input type="number" step="0.1" value={value} onChange={e=>onChange(Number(e.target.value))} className="bg-[#1A1F26] border border-gray-700 rounded px-1.5 py-0.5 outline-none text-[11px] w-full focus:border-blue-500"/>
  </div>
);

const StyleControls = ({style, onChange, hideAlign}: {style: TextStyle, onChange: (s:TextStyle)=>void, hideAlign?: boolean}) => (
  <div className="flex items-center gap-1">
    <select value={style.font} onChange={e=>onChange({...style,font:e.target.value as FontType})} className="bg-[#1A1F26] border border-gray-700 text-gray-300 rounded text-[10px] px-1 py-1 w-24">
      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
    </select>
    <input type="number" value={style.size} onChange={e=>onChange({...style,size:Number(e.target.value)})} className="bg-[#1A1F26] border border-gray-700 rounded w-10 px-1 py-1 text-[10px] text-center" title="Tam"/>
    <input type="color" value={style.color} onChange={e=>onChange({...style,color:e.target.value})} className="bg-transparent border-0 w-5 h-5 rounded cursor-pointer p-0" title="Color"/>
    {!hideAlign && (
       <div className="flex bg-[#1A1F26] rounded border border-gray-700 ml-auto">
          {['left','center','right'].map((a:any) => (
            <button key={a} onClick={()=>onChange({...style,align:a})} className={`p-1 ${style.align===a?'bg-gray-700 text-white':'text-gray-500'}`}>
               {a==='left'?<AlignLeft className="w-3 h-3"/>:a==='center'?<AlignCenter className="w-3 h-3"/>:<AlignRight className="w-3 h-3"/>}
            </button>
          ))}
       </div>
    )}
  </div>
);

const FrameControls = ({style, onChange}: any) => (
  <Section title="Estilo del Marco">
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-1 flex-1">
         <label className="text-[9px] text-gray-500">Grosor</label>
         <input type="number" step="0.5" value={style.thickness} onChange={e=>onChange({...style,thickness:Number(e.target.value)})} className="bg-[#1A1F26] border border-gray-700 rounded px-1.5 py-0.5 outline-none text-[11px]"/>
      </div>
      <div className="flex flex-col gap-1 flex-1">
         <label className="text-[9px] text-gray-500">Tipo</label>
         <select value={style.style} onChange={e=>onChange({...style,style:e.target.value})} className="bg-[#1A1F26] border border-gray-700 rounded px-1 py-1 outline-none text-[10px]">
            <option value="solid">Solida</option>
            <option value="dashed">Segmentada</option>
            <option value="dotted">Puntos</option>
         </select>
      </div>
      <div className="flex flex-col gap-1">
         <label className="text-[9px] text-gray-500">Color</label>
         <input type="color" value={style.color} onChange={e=>onChange({...style,color:e.target.value})} className="bg-transparent border-0 w-6 h-6 rounded cursor-pointer p-0 ml-1"/>
      </div>
    </div>
  </Section>
);
