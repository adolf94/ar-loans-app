import React, { useState, type JSX } from "react";
import apiClient from "../../services/api";
import { Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { X } from "lucide-react";

const ImageViewerDialog: React.FC<{
    children: JSX.Element,
    fileId?: string;
}> = ({  children, fileId }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [open, setOpen] = useState(false);

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
    
            {React.cloneElement(children, { onClick: () => setOpen(true) })}
        { open && <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="md" fullWidth >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Transaction Screenshot
                    <IconButton onClick={()=>setOpen(false)} size="small">
                        <X size={20} />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                        {loading && <CircularProgress />}
                        {error && (
                            <Typography color="error" variant="body2">
                                Failed to load image.
                            </Typography>
                        )}
                        {imgSrc && !loading && !error && (
                            <Box
                                component="img"
                                src={imgSrc}
                                alt="Transaction screenshot"
                                onClick={()=>window.open(imgSrc, '_blank')}
                                sx={{
                                    maxWidth: '100%',
                                    maxHeight: '70vh',
                                    objectFit: 'contain',
                                    borderRadius: 2,
                                }}
                            />
                        )}
                    </Box>
                </DialogContent>
            </Dialog>
        }
    </>;
};

export default ImageViewerDialog