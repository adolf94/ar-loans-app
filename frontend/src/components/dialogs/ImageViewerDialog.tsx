import React, { useState, type JSX } from "react";
import apiClient from "../../services/api";
import { Dialog, Spinner } from "../ui";
import { X, ZoomIn, ZoomOut, ExternalLink } from "lucide-react";

const ImageViewerDialog: React.FC<{
    children: JSX.Element,
    fileId?: string;
}> = ({ children, fileId }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [open, setOpen] = useState(false);
    const [zoom, setZoom] = useState(1);

    React.useEffect(() => {
        if (open && fileId) {
            setLoading(true);
            setError(false);
            apiClient.get(`/files/${fileId}`, { responseType: 'blob' })
                .then((res) => {
                    const blob = new Blob([res.data], { type: 'image/png' });
                    const url = URL.createObjectURL(blob);
                    setImgSrc(url);
                    setLoading(false);
                })
                .catch(() => {
                    setError(true);
                    setLoading(false);
                });
        }
        return () => {
            if (imgSrc) {
                URL.revokeObjectURL(imgSrc);
                setImgSrc(null);
            }
        };
    }, [open, fileId]);

    return <>

        {React.cloneElement(children, { onClick: () => { setOpen(true); setZoom(1); } })}
        {open && <Dialog open={open} onClose={() => setOpen(false)} width="max-w-3xl" paper>
            <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-ink font-semibold text-xl tracking-tight">Transaction Screenshot</h2>
                <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-md text-inksoft hover:text-ink hover:bg-ink/10 transition-colors">
                    <X size={18} strokeWidth={1.7} />
                </button>
            </div>
            <div className="flex justify-center items-center min-h-[300px]">
                {loading && <Spinner size={26} />}
                {error && (
                    <p className="text-sm text-bad" role="alert">
                        Failed to load image. Close this window and try again.
                    </p>
                )}
                {imgSrc && !loading && !error && (
                    <div className="w-full flex flex-col items-center gap-3">
                        <div className="overflow-hidden rounded-print border border-ink/20 bg-white max-w-full">
                            <img
                                src={imgSrc}
                                alt="Transaction screenshot"
                                onClick={() => window.open(imgSrc, '_blank')}
                                className="block max-w-full object-contain cursor-zoom-in transition-transform duration-200"
                                style={{ maxHeight: '70vh', transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoom <= 1} className="p-1.5 rounded-md border border-ink/25 text-inksoft hover:text-ink hover:border-ink/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                <ZoomOut size={15} strokeWidth={1.7} />
                            </button>
                            <span className="font-mono text-xs text-inksoft tnum w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3} className="p-1.5 rounded-md border border-ink/25 text-inksoft hover:text-ink hover:border-ink/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                <ZoomIn size={15} strokeWidth={1.7} />
                            </button>
                            <button aria-label="Open original" title="Open original" onClick={() => window.open(imgSrc, '_blank')} className="p-1.5 rounded-md border border-ink/25 text-inksoft hover:text-ink hover:border-ink/50 transition-colors">
                                <ExternalLink size={15} strokeWidth={1.7} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Dialog>}
    </>;
};

export default ImageViewerDialog
