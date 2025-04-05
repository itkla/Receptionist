'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import { IconLoader2, IconAlertCircle, IconDeviceDesktop, IconSignature, IconTrash, IconDeviceLaptop, IconScan, IconX } from '@tabler/icons-react';
import SignatureCanvas from 'react-signature-canvas';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BrowserMultiFormatReader, Result, NotFoundException, ChecksumException, FormatException } from '@zxing/library';

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
interface CoreScannerProps {
    onResult: (result: string | null) => void;
    onClose: () => void; // To close modal on fatal error
    isEnabled: boolean; // To control when the scanner is active
}

const CoreScannerComponent: React.FC<CoreScannerProps> = ({ onResult, onClose, isEnabled }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const readerRef = useRef<BrowserMultiFormatReader>(new BrowserMultiFormatReader());
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        if (!isEnabled) { 
             if (readerRef.current) {
                readerRef.current.reset(); 
            }
            if (stream) { 
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
            setError(null); 
            return; 
        }

        if (!videoRef.current) return;

        // Reader is already initialized in useRef
        const reader = readerRef.current;

        const startScan = async () => {
            setError(null);
            console.log("Attempting to start scan..."); 
            let mediaStream: MediaStream | null = null;

            try {
                // Attempt 1: Request environment camera directly
                console.log("Attempting getUserMedia with facingMode: environment");
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false
                });
                console.log("Successfully obtained environment camera stream.");
            } catch (errEnv: any) {
                console.warn("Failed to get environment camera:", errEnv.name, errEnv.message);
                // Attempt 2: Fallback to any camera if environment fails
                if (errEnv.name === 'OverconstrainedError' || errEnv.name === 'NotFoundError' || errEnv.name === 'NotReadableError') { 
                     console.log("Environment camera failed or not found, attempting default video input...");
                    try {
                         mediaStream = await navigator.mediaDevices.getUserMedia({
                            video: true, // Request any video input
                            audio: false
                         });
                         console.log("Successfully obtained default video stream.");
                    } catch (errDef: any) {
                        console.error("Failed to get default camera as well:", errDef.name, errDef.message);
                        // Re-throw or handle the final failure
                         throw errDef; // Throw the second error if fallback also fails
                    }
                } else {
                     // If the first error wasn't related to constraints/not found, re-throw it
                     throw errEnv;
                }
            }

            // --- If we successfully obtained a stream --- 
            if (!mediaStream) {
                 // This case should ideally be caught by the errors above, but as a safeguard
                 setError("Failed to obtain camera stream after attempts.");
                 console.error("MediaStream is null after getUserMedia attempts.");
                 return;
            }

            setStream(mediaStream);
            const currentVideoRef = videoRef.current;
            const reader = readerRef.current;

            if (currentVideoRef) {
                console.log("Video ref found, attempting to set srcObject.");
                currentVideoRef.srcObject = mediaStream;
                currentVideoRef.onloadedmetadata = () => {
                     console.log("Video metadata loaded.");
                     // Check readyState before playing
                     console.log(`Video readyState before play: ${currentVideoRef.readyState}`);

                     currentVideoRef?.play().then(() => {
                         console.log(`Video playback started successfully. Paused: ${currentVideoRef?.paused}`);
                         // Add a small delay before starting decode
                          setTimeout(() => {
                            // Check state AND dimensions again before decode
                             const videoEl = currentVideoRef; // Use consistent variable
                             if (reader && videoEl && !videoEl.paused && videoEl.readyState >= 3 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) { 
                                 console.log(`Starting decodeFromStream after delay... Dimensions: ${videoEl.videoWidth}x${videoEl.videoHeight}`); // Log dimensions
                                 reader.decodeFromStream(mediaStream, videoEl, (result, err) => {
                                      if (result) {
                                        // console.log("Scan successful:", result.getText());
                                        onResult(result.getText());
                                      } else if (err) {
                                        // Ignore common errors that happen during continuous scanning
                                        if (!(err instanceof NotFoundException || err instanceof ChecksumException || err instanceof FormatException)) {
                                             // Log less common errors, but maybe don't show to user unless persistent
                                             console.warn("Scan decode error:", err);
                                             // Consider adding logic for persistent decode errors
                                             // setError("Could not read barcode. Try adjusting position."); 
                                        }
                                      }
                                 }).catch(decodeErr => {
                                      console.error('Decode stream error:', decodeErr);
                                      setError("Failed to initialize scanner stream.");
                                 });
                             } else {
                                  console.warn(`Skipping decodeFromStream. Reader: ${!!reader}, VideoEl: ${!!videoEl}, Paused: ${videoEl?.paused}, ReadyState: ${videoEl?.readyState}, Width: ${videoEl?.videoWidth}, Height: ${videoEl?.videoHeight}`); // Log reasons
                             }
                          }, 300); // Delay for 300ms
                     }).catch(playErr => {
                         console.error("Video play error:", playErr);
                         setError("Could not start video stream.");
                     });
                 };
                 // Add error handling for the video element itself
                 currentVideoRef.onerror = (event) => {
                    console.error("Video element error:", event);
                    setError("An error occurred with the video stream display.");
                 };
             } else {
                console.error("Video element reference lost before attaching stream.");
                 setError("Video element not available.");
                 mediaStream.getTracks().forEach(track => track.stop());
                 setStream(null);
             }
        };
        // --- Error Handling for final failure --- 
        startScan().catch(finalErr => {
             console.error("Final catch block - Camera/Scanner setup error:", finalErr);
             if (finalErr.name === 'NotAllowedError') {
                 setError("Camera access denied. Please enable camera permissions in your browser settings.");
             } else if (finalErr.name === 'NotFoundError') {
                 setError("No camera found. Ensure a camera is connected and enabled.");
             } else if (finalErr.name === 'NotReadableError') {
                setError("Camera is already in use or access failed. Please ensure it's not used by another application and permissions are granted.");
             } else { 
                 setError(`Camera Error: ${finalErr.message || 'Unknown setup error'}`);
             }
        });

        // Cleanup function: Stop stream and reset reader on component unmount or when isEnabled changes to false
        return () => {
            if (readerRef.current) {
                readerRef.current.reset(); 
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        };
    }, [isEnabled, onResult, onClose]);

    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline /> {/* playsInline is important for mobile */} 
            {/* Optional: Add overlay for aiming */} 
             {/* <div className="absolute inset-0 border-4 border-red-500/50 pointer-events-none"></div> */} 
            {error && (
                 <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-center text-destructive p-4">
                     <p>{error}</p>
                </div>
             )}
         </div>
    );
};
// -----------------------------------------------------

export default function ShipmentReceivePage() {
  const params = useParams();
  const shortId = params?.shortId as string | undefined;

  const [shipment, setShipment] = useState<PublicShipmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);

  // State for received items
  const [receivedSerials, setReceivedSerials] = useState<Set<string>>(new Set());
  // Add state for list of extra device objects
  const [extraDevicesList, setExtraDevicesList] = useState<ExtraDeviceInput[]>([]);

  // State for user details
  const [recipientName, setRecipientName] = useState('');
  // Add state for signature interaction
  const [isSigned, setIsSigned] = useState(false); 
  // Add state for tracking successful submission in this session
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // State for modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExtraDeviceModalOpen, setIsExtraDeviceModalOpen] = useState(false);
  // State for extra device modal form
  const [extraDeviceFormData, setExtraDeviceFormData] = useState<Omit<ExtraDeviceInput, 'id'>>({
     serialNumber: '',
     assetTag: '',
     model: ''
  });

  // Fetch data
  useEffect(() => {
    if (!shortId) {
      setError('Shipment ID not found in URL.');
      setIsLoading(false);
      return;
    }
    const fetchShipmentDetails = async () => {
       // ... fetch logic using /api/public/shipments/[shortId] ...
       // Ensure the fetch uses shortId.toUpperCase()
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

  // --- Device Handling Callbacks ---
  const handleDeviceToggle = useCallback((serialNumber: string) => {
    console.log(`handleDeviceToggle called for: ${serialNumber}`); 
    setReceivedSerials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serialNumber)) {
        newSet.delete(serialNumber);
        toast.info(`Marked ${obfuscateSerial(serialNumber)} as NOT received.`); 
      } else {
        newSet.add(serialNumber);
        toast.success(`Marked ${obfuscateSerial(serialNumber)} as received.`); 
      }
      return newSet;
    });
  }, []);

  // Re-add handleScanResult function
  const handleScanResult = useCallback((scannedSerial: string | null) => {
       setIsScannerOpen(false); 
       if (scannedSerial) {
            const upperSerial = scannedSerial.toUpperCase();
           // Check against manifest devices
           const manifestDevice = shipment?.devices.find(d => d.serialNumber.toUpperCase() === upperSerial);
           if (manifestDevice) {
                 const exactManifestSerial = manifestDevice.serialNumber;
                 if (!receivedSerials.has(exactManifestSerial)) {
                     handleDeviceToggle(exactManifestSerial); // Toggle using exact case from manifest
                 } else {
                     toast.warning(`Device ${obfuscateSerial(exactManifestSerial)} already marked as received.`);
                 }
           } else {
                 // Check if already in extra list or received list before adding
                 const alreadyReceived = Array.from(receivedSerials).some(s => s.toUpperCase() === upperSerial);
                 const alreadyInExtraList = extraDevicesList.some(d => d.serialNumber.toUpperCase() === upperSerial);
                 
                 if (alreadyReceived) {
                    // This case implies it was on the manifest but toggled off, then scanned again. Or it was scanned as extra, submitted, then scanned again in a failed attempt.
                    toast.warning(`Device ${obfuscateSerial(upperSerial)} was already accounted for.`);
                 } else if (alreadyInExtraList) {
                    toast.warning(`Extra device ${obfuscateSerial(upperSerial)} already added to the list.`);
                 } else {
                     // Add as an ExtraDeviceInput object if truly new
                     setExtraDevicesList(prev => [...prev, { 
                         id: crypto.randomUUID(), 
                         serialNumber: upperSerial, 
                         assetTag: '', 
                         model: '' 
                     }]);
                      toast.info(`Added extra scanned device: ${obfuscateSerial(upperSerial)}.`);
                 }
           }
       }
   }, [shipment, handleDeviceToggle, extraDevicesList, receivedSerials]); // Dependencies might need adjustment based on exact logic needed

  // --- Modal Form Handlers ---
   const handleExtraDeviceFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setExtraDeviceFormData(prev => ({ ...prev, [name]: value }));
   };

   const handleAddExtraDeviceSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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
   };

   const handleRemoveExtraDevice = (idToRemove: string) => {
       setExtraDevicesList(prev => prev.filter(d => d.id !== idToRemove));
       // Maybe find serial to show in toast?
       // toast.success(`Removed extra device.`); 
   };

  // --- Signature Handling --- 
  const handleClearSignature = () => {
    signaturePadRef.current?.clear();
    setIsSigned(false); // Reset signed state on clear
  };

  // --- Final Form Submission --- 
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Check ref existence before isEmpty
    if (!recipientName.trim() || !signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toast.error("Missing Information", { description: "Please enter your name and provide a signature." });
      return;
    }
    
    // Check ref existence before toDataURL
    const signatureDataUrl = signaturePadRef.current.toDataURL('image/png');
    if (!signatureDataUrl) {
        toast.error("Signature Error", { description: "Could not capture signature data." });
        return;
    }

    setIsSubmitting(true);
    const toastId = 'submit-receipt';
    toast.loading("Submitting receipt...", { id: toastId });

    try {
      // Update payload to send extraDevicesList (excluding client-side ID)
      const payload = {
          recipientName: recipientName.trim(),
          signature: signatureDataUrl,
          receivedSerials: Array.from(receivedSerials),
          // Map extra devices to exclude temporary client ID
          extraDevices: extraDevicesList.map(({ id, ...rest }) => rest),
      };
      
      console.log("Submitting Payload:", payload);
      
      // Backend PUT needs update to handle `extraDevices` array of objects
      const response = await fetch(`/api/public/shipments/${shortId!.toUpperCase()}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Failed to submit receipt (HTTP ${response.status})`);
        }

      toast.success("Receipt Submitted!", { description: "Shipment marked as received.", id: toastId });
      // Instead of updating local shipment state, set the success flag
      setSubmissionSuccess(true); 

    } catch (err: any) {
        console.error("Error submitting receipt:", err);
      toast.error("Submission Failed", { description: err.message, id: toastId });
    } finally {
        setIsSubmitting(false);
    }
  };

  // Calculate disabled state and log values for debugging
  const isButtonDisabled = isSubmitting || !recipientName.trim() || !isSigned; // Use !isSigned

  console.log("Submit Button Check:", {
    isSubmitting,
    recipientName: recipientName.trim(),
    isSigned, // Log isSigned instead
    signaturePadRefCurrent: !!signaturePadRef.current,
    finalDisabledState: isButtonDisabled,
  });

  // --- Render Logic --- 
  if (isLoading) {
      return <div className="flex min-h-screen items-center justify-center"><IconLoader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>;
  }
  if (error) { 
      return (
           <div className="flex min-h-screen items-center justify-center text-center p-4">
              {/* ... error card ... */}
           </div>
       );
  }
  // Add check here: if still loading or error, or no shipment, don't proceed
  if (!shipment) { 
    return (
      <div className="flex min-h-screen items-center justify-center">
             <p className="text-muted-foreground">Shipment data could not be loaded or not found.</p>
      </div>
    );
  }

  // --- NEW: Check for immediate submission success FIRST ---
  if (submissionSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center text-center p-4">
        <Card className="max-w-md">
                 <CardHeader><CardTitle className="text-green-600">Receipt Confirmed</CardTitle></CardHeader>
                 <CardContent><p>Shipment <span className="font-mono font-semibold">{shipment.shortId}</span> successfully marked as received.</p></CardContent>
        </Card>
      </div>
    );
  }
  // --- End New Check ---

  // If already received (but not just submitted), show confirmation
  if (shipment.status === 'RECEIVED' || shipment.status === 'COMPLETED') { 
        return (
            <div className="flex min-h-screen items-center justify-center text-center p-4">
                <Card className="max-w-md"><CardHeader><CardTitle className="text-orange-600">Receipt Already Confirmed</CardTitle></CardHeader><CardContent><p>This shipment (ID: {shipment.shortId}) has already been marked as received.</p></CardContent></Card>
            </div>
        );
    }

  // Main receiving form (Only shown if not loading, no error, shipment exists, not just submitted, and not already received)
  return (
    <main className="container mx-auto max-w-3xl p-4 md:p-8 min-h-screen flex flex-col">
       {/* --- Scanner Modal --- */}
       <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
          <DialogContent>
             <DialogHeader><DialogTitle>Scan Device Barcode/QR</DialogTitle></DialogHeader>
             {/* Integrate the new CoreScannerComponent */}
             <div id="scanner-container" className="py-4">
                 {/* Conditionally render based on modal open state */} 
                  {isScannerOpen && (
                      <CoreScannerComponent 
                         onResult={handleScanResult} 
                         onClose={() => setIsScannerOpen(false)}
                         isEnabled={isScannerOpen} // Pass state to control scanner
                      />
                  )}
                  {/* Remove placeholder div */} 
                 <p className="text-xs text-muted-foreground mt-2 text-center">Requires camera access.</p>
             </div>
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

      <Card className="flex-grow flex flex-col">
        <CardHeader>
          <CardTitle className="text-2xl">Confirm Shipment Receipt</CardTitle>
          <CardDescription>
            Verify devices received for Shipment ID: <span className="font-mono font-semibold">{shipment.shortId}</span> from {shipment.senderName}.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col space-y-6 p-6">
          
           {/* Devices Section */}
           <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center">
                    <IconDeviceLaptop className="mr-2 h-5 w-5 text-muted-foreground"/> Manifested Devices ({shipment.devices?.length ?? 0})
                    </h3>
                     {/* Re-add Scan Button */} 
                     <div className="flex items-center gap-2">
                         <Button type="button" variant="outline" size="sm" onClick={() => setIsScannerOpen(true)} disabled={isSubmitting}>
                              <IconScan className="mr-2 h-4 w-4"/> Scan Device
                         </Button>
                         <Button type="button" variant="secondary" size="sm" onClick={() => setIsExtraDeviceModalOpen(true)} disabled={isSubmitting}>
                              <IconDeviceDesktop className="mr-2 h-4 w-4"/> Add Extra Device
                         </Button>
            </div>
                </div>
                 <p className="text-sm text-muted-foreground">Scan devices or manually check the box for each item received.</p>
                <ScrollArea className="h-72 w-full rounded-md border p-4">
                   {(shipment.devices?.length ?? 0) === 0 ? ( // Use optional chaining
                        <p className="text-sm text-center text-muted-foreground py-4">No devices listed on manifest.</p>
                   ) : (
                       shipment.devices.map((device) => {
                           // Determine if received (use full serial for check)
                           const isReceived = receivedSerials.has(device.serialNumber);
                           return (
                                <div key={device.id} className="flex items-center space-x-3 mb-3 border-b pb-3 last:border-b-0 last:pb-0 last:mb-0">
                                <Checkbox
                                    id={`device-${device.id}`}
                                    // Checked state depends on full serial being in the Set
                                    checked={isReceived}
                                    // Toggle uses the full serial
                                    onCheckedChange={() => handleDeviceToggle(device.serialNumber)}
                                    aria-labelledby={`label-${device.id}`}
                                    disabled={isSubmitting}
                                />
                                <Label
                                    htmlFor={`device-${device.id}`}
                                    id={`label-${device.id}`}
                                    className="flex-grow grid grid-cols-3 gap-2 text-sm font-normal cursor-pointer"
                                >
                                    {/* Display full serial if received, otherwise obfuscated */}
                                    <span className="font-mono col-span-1" title={device.serialNumber}>
                                        {isReceived ? device.serialNumber : obfuscateSerial(device.serialNumber)}
                                    </span>
                                    <span className="text-muted-foreground col-span-1">{device.assetTag || '-'}</span>
                                    <span className="text-muted-foreground col-span-1">{device.model || '-'}</span>
                                </Label>
                            </div>
                           );
                       })
                   )}
                </ScrollArea>
          </div>

            {/* Extra Devices Section - Remove old input/list */}
            {/* Display Added Extra Devices */}
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
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive/80" onClick={() => handleRemoveExtraDevice(device.id)} disabled={isSubmitting} title="Remove extra device">
                                     <IconTrash className="h-4 w-4"/>
                                </Button>
                             </div>
                        ))}
            </div>
          </div>
            )}

           <Separator />

           {/* Recipient Info Section */}
           <div className="space-y-4">
                 <h3 className="text-lg font-semibold">Recipient Information</h3>
             <div>
                    <Label htmlFor="recipientName">Your Name</Label>
                    <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required disabled={isSubmitting} className="mt-1"/>
             </div>
                 <div className="space-y-1">
                    <Label>Recipient Signature</Label>
                    <div className="relative rounded-md border border-input bg-background p-2 touch-none">
                     <SignatureCanvas
                        ref={signaturePadRef}
                        penColor='black'
                            canvasProps={{className: 'w-full h-48'}}
                            onEnd={() => setIsSigned(true)} 
                        />
                        {/* Clear Button */}
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={handleClearSignature}
                            title="Clear Signature"
                            disabled={isSubmitting}
                        >
                            <IconX className="h-4 w-4 text-muted-foreground"/>
                        </Button>
                    </div>
                 </div>
                </div>

            <CardFooter className="p-0 pt-6 mt-auto"> {/* Push footer to bottom */}
                 <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isButtonDisabled} // Use calculated state
                    title={
                        // Update title logic to use isSigned
                        !recipientName.trim() 
                            ? "Please enter recipient name." 
                            : (!isSigned 
                                ? "Please provide signature." 
                                : "Submit Receipt")
                    }
                >
                   {isSubmitting ? <IconLoader2 className="animate-spin mr-2"/> : null}
                   Confirm and Submit Receipt
                </Button>
            </CardFooter>
          </form>
      </Card>
    </main>
  );
} 