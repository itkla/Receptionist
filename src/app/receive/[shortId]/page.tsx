'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
// import { Toaster as SonnerToaster } from "sonner";
import { IconLoader2, IconAlertCircle, IconDeviceDesktop, IconSignature, IconTrash, IconDeviceLaptop, IconScan, IconX, IconArrowUp, IconCheck, IconAlertTriangle, IconHelpCircle, IconInfoCircle, IconDotsVertical, IconPlus } from '@tabler/icons-react';
import SignatureCanvas from 'react-signature-canvas';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BrowserMultiFormatReader, Result, NotFoundException, ChecksumException, FormatException } from '@zxing/library';
import { motion, useAnimation, useMotionValue, useTransform, animate, useDragControls } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// --- Types --- Using Prisma types directly where possible
import { Device as PrismaDevice, Shipment as PrismaShipment, ShipmentStatus } from '@prisma/client';

// Type for the data fetched from the public API
type PublicShipmentData = Pick<PrismaShipment, 'id' | 'shortId' | 'senderName' | 'createdAt' | 'status'> & {
  devices: Pick<PrismaDevice, 'id' | 'serialNumber' | 'assetTag' | 'model' | 'isCheckedIn'>[];
  location?: { name: string } | null; // Optional location info
};

// Type for devices added manually (not on manifest)
interface ExtraDeviceInput {
    id: string; // Client-side temporary ID for list key
  serialNumber: string;
  assetTag?: string;
    model?: string; // Renamed from description for consistency
}

// Helper to obfuscate serial number
const obfuscateSerial = (serial: string | null | undefined, keepLast = 4): string => {
    if (!serial) return 'N/A';
    if (serial.length <= keepLast) return serial; // Don't obfuscate if too short
    return `${'*'.repeat(serial.length - keepLast)}${serial.slice(-keepLast)}`;
};

// --- Core Scanner Component using @zxing/library --- 
// Define types for overlay data
type OverlayDataType = { serial: string; id: number };

interface CoreScannerProps {
    onResult: (result: string | null) => void;
    onClose: () => void;
    isEnabled: boolean; // To control when the scanner is active
    // Expose trigger functions via ref
    scannerActionTriggerRef?: React.RefObject<{
        triggerSuccess: (serial: string) => void;
        triggerUnknown: (serial: string) => void;
        triggerAlreadyScanned: (serial: string) => void;
    } | null>;
}

const CoreScannerComponent: React.FC<CoreScannerProps> = ({ 
    onResult, 
    onClose, 
    isEnabled, 
    scannerActionTriggerRef
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const readerRef = useRef<BrowserMultiFormatReader>(new BrowserMultiFormatReader());
    const [error, setError] = useState<string | null>(null);
    const [successOverlayData, setSuccessOverlayData] = useState<OverlayDataType | null>(null);
    const [unknownOverlayData, setUnknownOverlayData] = useState<OverlayDataType | null>(null);
    const [alreadyScannedOverlayData, setAlreadyScannedOverlayData] = useState<OverlayDataType | null>(null);
    const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Effect for camera setup/teardown
    useEffect(() => {
        console.log(`Scanner Effect: isEnabled changed to ${isEnabled}`);
        const reader = readerRef.current;
        const videoElement = videoRef.current;
        let streamTracks: MediaStreamTrack[] = []; 
        let isCleanupScheduled = false; 
        const cleanup = () => {
            if (isCleanupScheduled) return;
            isCleanupScheduled = true;
            console.log("Scanner cleanup running.");
            try { reader?.reset(); } catch (e) { console.error(e); }
            streamTracks.forEach(track => track.stop());
            streamTracks = []; 
            if (videoElement) { videoElement.srcObject = null; videoElement.onloadedmetadata = null; videoElement.onerror = null; }
        };

        if (isEnabled && videoElement) {
            setError(null);
            let currentStream: MediaStream | null = null; 

            const startScanner = async () => {
                console.log("Attempting getUserMedia...");
                if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setError("Camera access not supported.");
                    cleanup(); 
                    return;
                }

                try {
                    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                } catch (errEnv: any) {
                     console.warn("Environment camera failed, trying default...", errEnv.name);
                     if (errEnv.name === 'OverconstrainedError' || errEnv.name === 'NotFoundError' || errEnv.name === 'NotReadableError') {
                         try {
                             currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                         } catch (errDef: any) { throw errDef; } 
                     } else { throw errEnv; } 
                }
                
                if (!currentStream || isCleanupScheduled) {
                    if (!currentStream) setError("Failed to obtain camera stream.");
                    console.error("Stream null or cleanup scheduled after getUserMedia.");
                    cleanup(); 
                    return;
                }
                console.log("Stream obtained:", currentStream.id);
                streamTracks = currentStream.getTracks(); 

                videoElement.srcObject = currentStream;
                
                try {
                     await new Promise<void>((resolve, reject) => {
                          videoElement.onloadedmetadata = () => {
                             console.log("Video metadata loaded.");
                              videoElement.play()
                                 .then(() => {
                                      console.log("Video playback started.");
                                      resolve();
                                  })
                                 .catch(playErr => {
                                      console.error("Video play error:", playErr);
                                      reject(new Error("Could not start video playback."));
                                  });
                          };
                          videoElement.onerror = (event) => { 
                             console.error("Video element error during setup:", event);
                              reject(new Error("Video display error."));
                          };
                     });

                    if (isCleanupScheduled) {
                         console.log("Cleanup scheduled while waiting for video play.");
                         cleanup();
                         return;
                    }

                    console.log("Starting decodeFromStream...");
                    if (reader && videoElement && !videoElement.paused && videoElement.readyState >= 3) {
                        reader.decodeFromStream(currentStream, videoElement, (result, err) => { 
                            if (isCleanupScheduled) return; 
                            
                            if (successOverlayData || unknownOverlayData || alreadyScannedOverlayData) {
                                return;
                            }
                            
                            if (result) {
                                const scannedText = result.getText();
                                console.log(`[Scanner] Detected: ${scannedText}`);
                                onResult(scannedText);
                            } else if (err && !(err instanceof NotFoundException || err instanceof ChecksumException || err instanceof FormatException)) {
                                console.warn("Scan decode error:", err);
                            }
                        }).catch(decodeErr => {
                             if (isCleanupScheduled) return;
                            console.error('Decode stream error:', decodeErr);
                            setError("Failed to start decoder.");
                             cleanup(); 
                        });
                    } else {
                         console.warn("Skipping decode: Video state not ready or stream changed.");
                         cleanup(); 
                    }

                } catch (setupError: any) {
                     if (!isCleanupScheduled) {
                         setError(setupError.message || "Error setting up video playback.");
                         cleanup();
                     }
                }
            };

            startScanner().catch(finalErr => {
                if (!isCleanupScheduled) {
                    console.error("Camera/Scanner setup failed:", finalErr);
                    setError(`Camera Error: ${finalErr.message || 'Unknown setup error'}`);
                    cleanup();
                }
            });
        } else {
            cleanup();
            setError(null);
        }

        return cleanup;
        
    }, [isEnabled, onResult, successOverlayData, unknownOverlayData, alreadyScannedOverlayData]); 

    // Expose trigger functions via ref
    useEffect(() => {
        console.log('[CoreScannerComponent] Ref Setup Effect Running. Ref defined:', !!scannerActionTriggerRef);
        if (scannerActionTriggerRef && typeof scannerActionTriggerRef === 'object') {
            const refObject = {
                triggerSuccess: (serial: string) => {
                    console.log(`[CoreScannerComponent] triggerSuccess CALLED for ${serial}`);
                    setUnknownOverlayData(null); 
                    setAlreadyScannedOverlayData(null);
                    setSuccessOverlayData({ serial: serial, id: Date.now() });
                },
                triggerUnknown: (serial: string) => {
                    console.log(`[CoreScannerComponent] triggerUnknown CALLED for ${serial}`);
                    setSuccessOverlayData(null); 
                    setAlreadyScannedOverlayData(null);
                    setUnknownOverlayData({ serial: serial, id: Date.now() });
                },
                triggerAlreadyScanned: (serial: string) => {
                    console.log(`[CoreScannerComponent] triggerAlreadyScanned CALLED for ${serial}`);
                    setSuccessOverlayData(null); 
                    setUnknownOverlayData(null);
                    setAlreadyScannedOverlayData({ serial: serial, id: Date.now() });
                }
            };
            scannerActionTriggerRef.current = refObject;
             console.log('[CoreScannerComponent] Assigned functions to ref.current');
        }
        return () => {
            if (scannerActionTriggerRef?.current) {
                console.log('[CoreScannerComponent] Clearing functions from ref.current');
                 scannerActionTriggerRef.current = null;
            }
        };
    }, [scannerActionTriggerRef]);

    // Effect to clear overlays after a delay
    useEffect(() => {
        // Combine all overlay states to check if *any* overlay is active
        const currentOverlay = successOverlayData || unknownOverlayData || alreadyScannedOverlayData;
        if (currentOverlay) {
            console.log(`[CoreScannerComponent] Overlay Clear Effect: Starting 3s timeout for ${currentOverlay.serial}`);
            if (overlayTimeoutRef.current) {
                clearTimeout(overlayTimeoutRef.current);
            }
            overlayTimeoutRef.current = setTimeout(() => {
                console.log("[CoreScannerComponent] Overlay Clear Effect: Clearing ALL overlay data via timeout.");
                setSuccessOverlayData(null);
                setUnknownOverlayData(null);
                setAlreadyScannedOverlayData(null);
            }, 3000); // Reduced timeout to 3 seconds
        }
        return () => {
            if (overlayTimeoutRef.current) {
                clearTimeout(overlayTimeoutRef.current);
            }
        };
    }, [successOverlayData, unknownOverlayData, alreadyScannedOverlayData]);

    console.log('[CoreScannerComponent] Rendering. Success Data:', successOverlayData, 'Unknown Data:', unknownOverlayData, 'Already Scanned Data:', alreadyScannedOverlayData); // Log state before render

    return (
        <div className="relative aspect-square w-full overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline /> 
            {/* Success Overlay */}
            {successOverlayData && (
                <motion.div
                    key={`success-${successOverlayData.id}`} // Unique key
                    className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/90 text-white pointer-events-none z-10" // Added z-10
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }} 
                    transition={{ duration: 0.2 }}
                >
                    <IconCheck size={64} strokeWidth={2} />
                    <p className="mt-2 font-semibold text-lg break-all px-4">{successOverlayData.serial}</p>
                </motion.div>
            )}
            {/* Unknown Overlay */}
            {unknownOverlayData && (
                <motion.div
                    key={`unknown-${unknownOverlayData.id}`} // Unique key
                    className="absolute inset-0 flex flex-col items-center justify-center bg-orange-500/90 text-white pointer-events-none z-10" // Added z-10
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }} 
                    transition={{ duration: 0.2 }}
                >
                    <IconHelpCircle size={64} strokeWidth={2} /> 
                    <p className="mt-2 font-semibold text-lg break-all px-4">Unknown: {unknownOverlayData.serial}</p>
                </motion.div>
            )}
            {/* Already Scanned Overlay (New) */}
            {alreadyScannedOverlayData && (
                <motion.div
                    key={`already-${alreadyScannedOverlayData.id}`}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-gray-500/90 text-white pointer-events-none z-10"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }} 
                    transition={{ duration: 0.2 }}
                >
                    <IconInfoCircle size={64} strokeWidth={2} /> 
                    <p className="mt-2 font-semibold text-lg break-all px-4">Already Scanned: {alreadyScannedOverlayData.serial}</p>
                </motion.div>
            )}
             {/* Aiming overlay (Optional) */}
             {/* <div className="absolute inset-0 border-4 border-red-500/50 pointer-events-none"></div> */}
            {error && (
                 <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-center text-destructive p-4 z-20"> {/* Ensure error is on top */}
                     <p>{error}</p>
                </div>
             )}
         </div>
    );
};
// -----------------------------------------------------

// --- New Interaction State Type ---
type InteractionStateType = 'idle' | 'swiping' | 'submitting' | 'success' | 'error' | 'alreadyReceived';

export default function ShipmentReceivePage() {
    // --- All State and Hook Declarations First --- 
  const params = useParams();
    const shortId = params?.shortId as string | undefined;
    const signaturePadRef = useRef<SignatureCanvas>(null);
    const [shipment, setShipment] = useState<PublicShipmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receivedSerials, setReceivedSerials] = useState<Set<string>>(new Set());
    const [extraDevicesList, setExtraDevicesList] = useState<ExtraDeviceInput[]>([]);
  const [recipientName, setRecipientName] = useState('');
    const [isSigned, setIsSigned] = useState(false);
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isExtraDeviceModalOpen, setIsExtraDeviceModalOpen] = useState(false);
    const [extraDeviceFormData, setExtraDeviceFormData] = useState<Omit<ExtraDeviceInput, 'id'>>({
     serialNumber: '',
     assetTag: '',
     model: ''
    });
    const [interactionState, setInteractionState] = useState<InteractionStateType>('idle');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const cardY = useMotionValue(0);
    const dragControls = useDragControls();
    // Ref to trigger actions in scanner
    const scannerActionTriggerRef = useRef<{
        triggerSuccess: (serial: string) => void;
        triggerUnknown: (serial: string) => void;
        triggerAlreadyScanned: (serial: string) => void;
    } | null>(null);
    
    // --- Transformations for background text (optional - maybe remove if background is static?) ---
    // These might feel disconnected now. Consider removing or basing on cardY.
    // const backgroundTextOpacity = useTransform(cardY, [0, -100], [1, 0]); 
    // const backgroundTextY = useTransform(cardY, [0, -100], [0, -20]); 

    // --- Define Can Submit Logic Early --- 
    const canSubmit = !isSubmitting && recipientName.trim() && isSigned && !submissionSuccess;

    // --- Moved useEffect for Initial State Setting --- 
    useEffect(() => {
        if (shipment) {
             if (submissionSuccess) { 
                 setInteractionState('success');
                 setStatusMessage(`Receipt for ${shipment.shortId} confirmed.`);
             } else if (shipment.status === 'RECEIVED' || shipment.status === 'COMPLETED') {
                 setInteractionState('alreadyReceived');
                 setStatusMessage(`Shipment ${shipment.shortId} already received.`);
             } else {
                 // No explicit idle set needed if default state is idle
             }
        }
    }, [shipment, submissionSuccess]);

    // --- Fetch Data useEffect --- 
    // (This was already near the top, which is good)
  useEffect(() => {
        if (!shortId) {
      setError('Shipment ID not found in URL.');
      setIsLoading(false);
      return;
    }
    const fetchShipmentDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
                const response = await fetch(`/api/public/shipments/${shortId.toUpperCase()}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Error fetching shipment (HTTP ${response.status})`);
        }
        setShipment(data);
                // Pre-check items already marked as received (if API provides isCheckedIn)
                const preChecked = new Set<string>();
                data.devices?.forEach((device:any) => {
                    if (device.isCheckedIn) {
                        preChecked.add(device.serialNumber);
                    }
                });
                setReceivedSerials(preChecked);
      } catch (err: any) {
        console.error("Error fetching shipment details:", err);
        setError(err.message || 'Failed to load shipment details.');
        toast.error("Error Loading Shipment", { description: err.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchShipmentDetails();
    }, [shortId]);

    // --- All useCallback Hooks --- 
    // (Ensure these are also before conditional returns)
    const handleDeviceToggle = useCallback((serialNumber: string) => {
        // This function ONLY toggles state. Toasts are handled by caller (manual click or scan result)
        console.log(`handleDeviceToggle called for: ${serialNumber}`); 
        setReceivedSerials(prev => {
            const newSet = new Set(prev);
            if (newSet.has(serialNumber)) {
                newSet.delete(serialNumber);
            } else {
                newSet.add(serialNumber);
            }
            return newSet;
        });
    }, []);

    const handleScanResult = useCallback((scannedSerial: string | null) => {
        if (scannedSerial) {
            const upperSerial = scannedSerial.toUpperCase();
            console.log(`[Scan Result]: ${upperSerial}`);
            const manifestDevice = shipment?.devices.find(d => d.serialNumber.toUpperCase() === upperSerial);
            
            if (manifestDevice) {
                console.log(`[Scan Result]: Found on manifest.`);
                const exactManifestSerial = manifestDevice.serialNumber;
                // Check if ALREADY received FIRST
                if (receivedSerials.has(exactManifestSerial)) {
                    // If already received, just show the overlay and toast, DO NOT toggle
                    console.log(`[Scan Result]: Already received. Triggering Already Scanned overlay.`);
                    toast.warning(`Device ${obfuscateSerial(exactManifestSerial)} already marked as received.`);
                    scannerActionTriggerRef.current?.triggerAlreadyScanned(exactManifestSerial);
                } else {
                    // If NOT received, THEN toggle and show success overlay/toast
                    console.log(`[Scan Result]: New scan. Triggering Success overlay and toggling check.`);
                    handleDeviceToggle(exactManifestSerial); // Only toggle if it wasn't already checked
                    scannerActionTriggerRef.current?.triggerSuccess(exactManifestSerial);
                }
            } else {
                 // Logic for unknown devices remains the same
                 console.log(`[Scan Result]: Not found on manifest.`);
                 toast.warning(`Device not found on manifest`, {
                     description: `Scanned: ${obfuscateSerial(upperSerial)}`,
                 });
                 scannerActionTriggerRef.current?.triggerUnknown(upperSerial);
            }
        }
    }, [shipment, handleDeviceToggle, receivedSerials]);

    const handleExtraDeviceFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setExtraDeviceFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleAddExtraDeviceSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
        const { serialNumber, assetTag, model } = extraDeviceFormData;
        const trimmedSerial = serialNumber.trim().toUpperCase();

        if (!trimmedSerial) {
            toast.error("Serial number is required for extra devices.");
            return;
        }

        // Check if already on manifest or received list
        const manifestDevice = shipment?.devices.find(d => d.serialNumber.toUpperCase() === trimmedSerial);
        const alreadyReceived = Array.from(receivedSerials).some(s => s.toUpperCase() === trimmedSerial);
        const alreadyInExtraList = extraDevicesList.some(d => d.serialNumber.toUpperCase() === trimmedSerial);

        if (manifestDevice) {
            toast.warning(`Device ${obfuscateSerial(trimmedSerial)} is already on the manifest. Please check it off above.`);
            return;
        } 
        if (alreadyReceived) {
            toast.warning(`Device ${obfuscateSerial(trimmedSerial)} was on the manifest and is already marked received.`);
      return;
    }
        if (alreadyInExtraList) {
            toast.warning(`Extra device ${obfuscateSerial(trimmedSerial)} already added.`);
        return;
    }

        // Add to list
        setExtraDevicesList(prev => [
            ...prev,
            {
                id: crypto.randomUUID(),
                serialNumber: trimmedSerial,
                assetTag: assetTag?.trim() || undefined,
                model: model?.trim() || undefined
            }
        ]);

        toast.success(`Added extra device: ${obfuscateSerial(trimmedSerial)}`);
        // Reset form and close modal
        setExtraDeviceFormData({ serialNumber: '', assetTag: '', model: '' });
        setIsExtraDeviceModalOpen(false);
    }, [shipment, receivedSerials, extraDevicesList, extraDeviceFormData]); // Ensure dependencies are correct

    const handleRemoveExtraDevice = useCallback((idToRemove: string) => {
        setExtraDevicesList(prev => prev.filter(d => d.id !== idToRemove));
        // Maybe find serial to show in toast?
        // toast.success(`Removed extra device.`); 
    }, []);

    const handleClearSignature = useCallback(() => {
        signaturePadRef.current?.clear();
        setIsSigned(false); 
    }, []);

    const handleActualSubmit = useCallback(async () => {
        console.log('[handleActualSubmit] Called');
        setInteractionState('submitting'); 
    setIsSubmitting(true);
        setError(null);
        setStatusMessage('');
        
        // Validation first (prevents API call if invalid)
        if (!shortId) { 
            setStatusMessage("Error: Shipment ID is missing.");
            setInteractionState('error'); 
            setIsSubmitting(false);
            // Card should stay hidden in error state
            return;
         }
        const signatureData = signaturePadRef.current?.toDataURL('image/png');
        if (signaturePadRef.current?.isEmpty() || !signatureData) {
            toast.error("Signature is required.");
            setInteractionState('idle'); 
            setIsSubmitting(false);
            animate(cardY, 0, { type: 'spring', stiffness: 300, damping: 30 }); // Animate card back
            return;
        }
        if (!recipientName.trim()) {
            toast.error("Recipient name is required.");
            setInteractionState('idle'); 
            setIsSubmitting(false);
            animate(cardY, 0, { type: 'spring', stiffness: 300, damping: 30 }); // Animate card back
            return;
        }
        
        // Proceed with API call
        try {
            const payload = {
                recipientName: recipientName.trim(),
                signature: signatureData,
                receivedSerials: Array.from(receivedSerials),
                extraDevices: extraDevicesList.map(({ id, ...rest }) => rest) // Remove temporary client ID
            };
            const response = await fetch(`/api/public/shipments/${shortId}`, {
            method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
             }
        const result = await response.json();
            setStatusMessage(`Receipt for ${shortId} confirmed!`);
            setSubmissionSuccess(true); 
            setInteractionState('success');
        } catch (err: any) {
            setError(err.message || "..."); 
            setStatusMessage(`Error: ${err.message || "Submission failed."}`);
            setInteractionState('error');
            setIsSubmitting(false); // Allow retry via potential UI reset later
        }
    }, [shortId, recipientName, receivedSerials, extraDevicesList, cardY]); // Added cardY dependency

    // --- Drag End Handler (Now on Card Wrapper) --- 
    const handleCardDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number; }; velocity: { x: number; y: number; }; }) => {
        console.log('[CardDragEnd] Fired. Offset Y:', info.offset.y, 'Velocity Y:', info.velocity.y);
        const swipeThreshold = -100; 
        const velocityThreshold = -500; 
        const dragBuffer = -20;

        // Check if swipe met threshold
        const shouldSubmit = info.offset.y < swipeThreshold || (info.offset.y < dragBuffer && info.velocity.y < velocityThreshold);
        console.log('[CardDragEnd] Should Submit:', shouldSubmit);

        if (shouldSubmit) {
            // Don't reset position, call submit. Submission state handles final appearance.
            handleActualSubmit(); 
        } else {
            // Didn't swipe enough, snap card back smoothly
            console.log('[CardDragEnd] Threshold NOT met. Snapping card back.');
            setInteractionState('idle'); // Ensure state is idle if drag fails
            animate(cardY, 0, { type: 'spring', stiffness: 300, damping: 30 });
        }
    }, [cardY, handleActualSubmit]); // Dependencies updated

    // --- End of Hook Declarations ---
    console.log('[ReceivePage] Hooks declared. isLoading:', isLoading, 'error:', error, 'shipment:', !!shipment, 'interactionState:', interactionState);

    // --- Render Logic Starts Here --- 

    // Initial Loading/Error states (these early returns are okay as they don't skip hooks)
  if (isLoading) {
        console.log('[ReceivePage] Rendering: Loading state');
        return <div className="flex min-h-screen items-center justify-center"><IconLoader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>;
    }
    if (error && !shipment) { // Only show full error if shipment failed to load at all
        console.log('[ReceivePage] Rendering: Initial fetch error state');
    return (
      <div className="flex min-h-screen items-center justify-center text-center p-4">
                <Card className="max-w-md"><CardHeader><CardTitle className="text-destructive">Error Loading Shipment</CardTitle></CardHeader><CardContent><p>{error}</p></CardContent></Card>
      </div>
    );
  }
  if (!shipment) {
        console.log('[ReceivePage] Rendering: No shipment data state');
    return (
      <div className="flex min-h-screen items-center justify-center">
               <p className="text-muted-foreground">Shipment data could not be loaded or not found.</p>
      </div>
    );
  }

    // Define background colors based on state
    const backgroundColors = {
        idle: 'bg-neutral-800',
        swiping: 'bg-blue-600',
        submitting: 'bg-blue-700 animate-pulse',
        success: 'bg-green-600',
        error: 'bg-red-600',
        alreadyReceived: 'bg-orange-600',
    };
    const currentBgColor = backgroundColors[interactionState] || 'bg-neutral-800';
    console.log('[ReceivePage] Rendering: Main interactive UI. state:', interactionState, 'canSubmit:', canSubmit, 'isSigned:', isSigned, 'name:', recipientName, 'isSubmitting:', isSubmitting);

    // --- Conditional Return for Final States (Full Screen Background) --- 
     if (interactionState === 'success' || interactionState === 'error' || interactionState === 'alreadyReceived') {
         console.log(`[ReceivePage] Rendering: Final state (${interactionState}) - Full Screen Background`);
        return (
             <motion.div
                 className={`fixed inset-0 text-white p-8 flex flex-col justify-center items-center ${currentBgColor} transition-colors duration-300`}
                 style={{ zIndex: 10 }} 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
             >
                 <motion.div 
                     className="text-center font-semibold text-xl md:text-2xl flex flex-col items-center space-y-4"
                     initial={{ opacity: 0, y: 10 }} 
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.2 }}
                 >
                     {/* Replaced emojis with Tabler Icons */}
                     {interactionState === 'success' && <IconCheck size={48} strokeWidth={1.5} />}
                     {interactionState === 'error' && <IconX size={48} strokeWidth={1.5} />}
                     {interactionState === 'alreadyReceived' && <IconAlertTriangle size={48} strokeWidth={1.5} />}
                     <p>{statusMessage}</p>
                 </motion.div>
             </motion.div>
         );
     }

    // --- Main Return JSX (Idle/Swiping State) --- 
  return (
        <main className="relative flex flex-col overflow-hidden h-screen pb-32">
            {/* <SonnerToaster richColors position="top-center" />  */}
            {/* --- Scanner Modal --- */}
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogContent className="sm:max-w-md p-0">
                    <DialogHeader className="p-4 pb-0">
                        <DialogTitle>Scan Device Barcode/QR</DialogTitle>
                        <DialogDescription>Position the code within the frame.</DialogDescription>
                    </DialogHeader>
                    <div className="p-4">
                        {isScannerOpen && (
                            <CoreScannerComponent
                               scannerActionTriggerRef={scannerActionTriggerRef}
                                onResult={handleScanResult}
                                onClose={() => setIsScannerOpen(false)}
                                isEnabled={isScannerOpen} 
                            />
                        )}
                    </div>
                    <DialogFooter className="p-4 pt-0">
                        <Button variant="outline" onClick={() => setIsScannerOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
             {/* ------------------ */}

             {/* --- Add Extra Device Modal --- */}
             <Dialog open={isExtraDeviceModalOpen} onOpenChange={setIsExtraDeviceModalOpen}>
                  <DialogContent className="sm:max-w-[450px]">
                       <DialogHeader>
                           <DialogTitle>Add Extra Device</DialogTitle>
                           <DialogDescription>
Enter details for a device received that was not on the original manifest.
                           </DialogDescription>
                       </DialogHeader>
                       <form onSubmit={handleAddExtraDeviceSubmit} className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="modal-extra-serial" className="text-right">Serial*</Label>
                              <Input id="modal-extra-serial" name="serialNumber" value={extraDeviceFormData.serialNumber} onChange={handleExtraDeviceFormChange} required className="col-span-3"/>
                          </div>
                           <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="modal-extra-asset" className="text-right">Asset Tag</Label>
                              <Input id="modal-extra-asset" name="assetTag" value={extraDeviceFormData.assetTag} onChange={handleExtraDeviceFormChange} placeholder="Optional" className="col-span-3"/>
                          </div>
                           <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="modal-extra-model" className="text-right">Model/Desc</Label>
                              <Input id="modal-extra-model" name="model" value={extraDeviceFormData.model} onChange={handleExtraDeviceFormChange} placeholder="Optional" className="col-span-3"/>
                          </div>
                          <DialogFooter>
                              <Button type="submit">Add Device</Button>
                          </DialogFooter>
                       </form>
                  </DialogContent>
             </Dialog>
             {/* ----------------------------- */}

            {/* --- Full Screen Background Color Layer --- */}
            <motion.div
                className={`fixed inset-0 ${currentBgColor} transition-colors duration-300`}
                style={{ zIndex: 0 }}
                animate={{ backgroundColor: backgroundColors[interactionState] }} 
            />

            {/* --- Invisible Swipe Target Area (Simplified Structure) --- */}
            { (interactionState === 'idle' || interactionState === 'swiping' || interactionState === 'submitting') && (
                 <div 
                    className="absolute bottom-0 left-0 right-0 h-32 flex flex-col items-center justify-center text-white"
                    style={{ zIndex: 1, cursor: canSubmit ? 'grab' : 'default', touchAction: 'none' }} 
                    onPointerDown={(e) => {
                        console.log('[PointerDown] Fired on swipe target. State:', interactionState, 'CanSubmit:', canSubmit);
                        if (canSubmit && interactionState === 'idle') {
                            console.log('[PointerDown] Conditions met. Calling dragControls.start...');
                            try {
                                dragControls.start(e, { snapToCursor: false }); 
                                console.log('[PointerDown] dragControls.start called successfully.');
                            } catch (dragError) {
                                console.error('[PointerDown] Error calling dragControls.start:', dragError);
                            }
                        } else {
                            console.log('[PointerDown] Conditions NOT met. Drag not initiated.');
                        }
                    }}
                 >
                    <IconArrowUp className="h-5 w-5 mx-auto mb-1" />
                    <span>
                        {interactionState === 'idle' && canSubmit && 'Swipe up to Submit'}
                        {interactionState === 'idle' && !canSubmit && 'Complete form to enable submission'}
                    </span>
                 </div>
             )}

            {/* --- Card Wrapper (Draggable via Controls) --- */}
            { (interactionState === 'idle' || interactionState === 'swiping' || interactionState === 'submitting') && (
                <motion.div
                    className="relative rounded-b-2xl rounded-t-none overflow-hidden flex-grow flex flex-col max-h-[90vh]" 
                    style={{ zIndex: 2, y: cardY }} 
                    drag="y" 
                    dragControls={dragControls} 
                    dragListener={false} 
                    dragConstraints={{ top: -window.innerHeight, bottom: 0 }} 
                    dragElastic={{ top: 0.1, bottom: 0.8 }} 
                    onDragEnd={handleCardDragEnd} 
                    initial={{ y: 0 }}
                >
                    <Card className="border-none flex-grow flex flex-col shadow-xl bg-card w-full overflow-hidden"> 
        <CardHeader>
                            <CardTitle className="text-2xl">Confirm Shipment Receipt</CardTitle>
          <CardDescription>
                                Verify devices received for Shipment ID: <span className="font-mono font-semibold">{shipment.shortId}</span> from {shipment.senderName}.
          </CardDescription>
        </CardHeader>
                        <CardContent 
                            className="flex-grow flex flex-col space-y-6 p-6 overflow-y-auto touch-action-pan-y"
                        > 
                            <div className="space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                    <h3 className="text-lg font-semibold flex items-center mb-2 md:mb-0">
                                        <IconDeviceLaptop className="mr-2 h-5 w-5 text-muted-foreground"/> Manifested Devices ({shipment?.devices?.length ?? 0})
                                    </h3>
                                    <div className="flex items-center gap-2 self-start md:self-center">
                                        <Button type="button" variant="default" size="sm" onClick={() => setIsScannerOpen(true)} disabled={isSubmitting || interactionState !== 'idle'}>
                                            <IconScan className="mr-2 h-4 w-4"/> Scan Device
                                        </Button>
                                        <Button type="button" variant="secondary" size="sm" onClick={() => setIsExtraDeviceModalOpen(true)} disabled={isSubmitting || interactionState !== 'idle'}>
                                            <IconPlus className="mr-2 h-4 w-4"/> Add Extra Device
                                        </Button>
            </div>
            </div>
                                <p className="text-sm text-muted-foreground">Scan devices to check them in.</p>
                                <ScrollArea className="h-72 w-full rounded-md border p-4">
                                    {(shipment.devices?.length ?? 0) === 0 ? (
                                        <p className="text-sm text-center text-muted-foreground py-4">No devices listed on manifest.</p>
                                    ) : (
                                        shipment.devices.map((device) => {
                                            const isReceived = receivedSerials.has(device.serialNumber);
                                            return (
                                                <div 
                                                    key={device.id} 
                                                    className={`flex items-center space-x-2 mb-3 border-b pb-3 last:border-b-0 last:pb-0 last:mb-0 p-2 rounded transition-colors ${
                                                        isReceived 
                                                        ? 'bg-green-50 dark:bg-green-900/20'
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
                                                    }`}
                                                >
                                                    <Label
                                                        id={`label-${device.id}`}
                                                        className="flex-grow grid grid-cols-3 gap-2 text-sm font-normal cursor-default items-center"
                                                    >
                                                        <span className="font-mono col-span-1 flex items-center" title={device.serialNumber}>
                                                            {isReceived && <IconCheck className="h-4 w-4 inline-block text-green-600 mr-1 flex-shrink-0" />}
                                                            {isReceived ? device.serialNumber : obfuscateSerial(device.serialNumber)}
                                                        </span>
                                                        <span className="text-muted-foreground col-span-1">{device.assetTag || '-'}</span>
                                                        <span className="text-muted-foreground col-span-1">{device.model || '-'}</span>
                                                    </Label>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 flex-shrink-0" 
                                                                disabled={isSubmitting || interactionState !== 'idle'}
                                                                aria-label={`Actions for ${device.serialNumber}`}
                                                            >
                                                                <IconDotsVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem 
                                                                onSelect={() => handleDeviceToggle(device.serialNumber)}
                                                                disabled={isSubmitting || interactionState !== 'idle'}
                                                            >
                                                                {isReceived ? 'Mark as Not Received' : 'Mark as Received'}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            );
                                        })
                                    )}
                                </ScrollArea>
          </div>

                            {extraDevicesList.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold flex items-center">
                                        <IconDeviceDesktop className="mr-2 h-5 w-5 text-muted-foreground"/> Added Extra Devices ({extraDevicesList.length})
            </h3>
                                    <div className="border rounded p-3 space-y-2">
                                        {extraDevicesList.map(device => (
                                            <div key={device.id} className="flex items-center justify-between text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-mono" title={device.serialNumber}>{obfuscateSerial(device.serialNumber)}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {device.assetTag || '-'} / {device.model || '-'}
                                                    </span>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive/80" onClick={() => handleRemoveExtraDevice(device.id)} disabled={isSubmitting || interactionState !== 'idle'} title="Remove extra device">
                                                    <IconTrash className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        ))}
            </div>
          </div>
                            )}

                            <Separator />

                            {/* Make this section grow and be a flex column */}
                            <div className="space-y-4 flex-grow flex flex-col">
                                <h3 className="text-lg font-semibold">Recipient Information</h3>
             <div>
                                    <Label htmlFor="recipientName">Your Name</Label>
                                    <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required disabled={isSubmitting || interactionState !== 'idle'} className="mt-1"/>
             </div>
                                {/* Make this signature container grow and be a flex column */}
                                <div className="space-y-1 flex-grow flex flex-col">
                                    <Label>Recipient Signature</Label>
                                    {/* Make this wrapper div grow but also have a minimum height */}
                                    <div className="relative rounded-md border border-input bg-white p-2 touch-none flex-grow h-full min-h-[200px]">
                     <SignatureCanvas
                        ref={signaturePadRef}
                        penColor='black'
                                            canvasProps={{className: 'w-full h-full bg-white'}} 
                                            onEnd={() => setIsSigned(true)}
                                        />
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute top-1 right-1 h-6 w-6"
                                            onClick={handleClearSignature}
                                            title="Clear Signature"
                                            disabled={isSubmitting || interactionState !== 'idle'}
                                        >
                                            <IconX className="h-4 w-4 text-muted-foreground"/>
                                        </Button>
                                        {(isSubmitting || interactionState !== 'idle') && <div className="absolute inset-0 bg-gray-100/50 cursor-not-allowed"></div>}
                                    </div>
                </div>
             </div>
        </CardContent>
      </Card>
                    {(interactionState !== 'idle') && (
                        <div className="absolute inset-0 bg-transparent cursor-not-allowed" style={{ zIndex: 3 }}></div>
                    )}
                </motion.div>
             )}
    </main>
  );
} 