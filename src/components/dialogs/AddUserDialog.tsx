'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { IconLoader2 } from '@tabler/icons-react';
import { z } from 'zod';

const createUserSchemaClient = z.object({
    name: z.string().trim().min(1, { message: "Name is required." }),
    email: z.string().trim().email({ message: "Invalid email address." }),
    password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
});

type FormData = z.infer<typeof createUserSchemaClient>;

interface AddUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUserAdded: () => void; // Callback to refresh the user list
}

export function AddUserDialog({ open, onOpenChange, onUserAdded }: AddUserDialogProps) {
    const [formData, setFormData] = useState<FormData>({ name: '', email: '', password: '' });
    const [errors, setErrors] = useState<z.ZodFormattedError<FormData> | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors) {
            // Clear specific field error on change
            setErrors(prev => prev ? { ...prev, _errors: prev._errors, [name as keyof FormData]: undefined } : null);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrors(null);
        setIsLoading(true);

        // Client-side validation
        const validation = createUserSchemaClient.safeParse(formData);
        if (!validation.success) {
            setErrors(validation.error.format());
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validation.data),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Failed to add user (HTTP ${response.status})`);
            }

            toast.success("User Added Successfully!", {
                description: `User ${result.name} (${result.email}) created.`,
            });

            setFormData({ name: '', email: '', password: '' }); // Reset form
            onUserAdded(); // Trigger refresh
            onOpenChange(false); // Close dialog

        } catch (err: any) {
            console.error("Error adding user:", err);
            toast.error("Failed to Add User", { description: err.message });
            // Optionally set a general form error state here if needed
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) { // Reset form if dialog is closed externally
                setFormData({ name: '', email: '', password: '' });
                setErrors(null);
            }
            onOpenChange(isOpen);
        }}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Add New Admin User</DialogTitle>
                    <DialogDescription>
                        Fill in the details to create a new administrator account.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className={`col-span-3 ${errors?.name ? 'border-red-500' : ''}`}
                            required
                        />
                        {errors?.name && <p className="col-span-4 text-xs text-red-500 text-right -mt-2">{errors.name._errors.join(', ')}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className={`col-span-3 ${errors?.email ? 'border-red-500' : ''}`}
                            required
                        />
                        {errors?.email && <p className="col-span-4 text-xs text-red-500 text-right -mt-2">{errors.email._errors.join(', ')}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            className={`col-span-3 ${errors?.password ? 'border-red-500' : ''}`}
                            required
                            minLength={8}
                        />
                        {errors?.password && <p className="col-span-4 text-xs text-red-500 text-right -mt-2">{errors.password._errors.join(', ')}</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <><IconLoader2 className="animate-spin mr-2" /> Adding...</> : 'Add User'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 