// app/(root)/(routes)/companion/[companionId]/companion-form.tsx
"use client";

import * as z from "zod";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import type { Category, Companion } from "@prisma/client"; // why: server-only lib; type-only avoids client crash
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/image-upload";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREAMBLE = `You are a fictional character whose name is Elon. 
You are a visionary entrepreneur and inventor. 
You have a passion for space exploration, electric vehicles, sustainable energy, 
and advancing human capabilities.`;

const SEED_CHAT = `Human: Hi Elon, how's your day been?
Elon: Busy as always. Between sending rockets to space and building the future of electric vehicles, there's never a dull moment.
`;

const formSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().min(1, "Description is required."),
  instructions: z.string().min(200, "Instructions require at least 200 characters."),
  seed: z.string().min(200, "Seed requires at least 200 characters."),
  src: z.string().min(1, "Image is required."),
  categoryId: z.string().min(1, "Category is required."),
});

interface CompanionFormProps {
  categories: Category[];
  initialData: Companion | null;
}

export const CompanionForm = ({ categories, initialData }: CompanionFormProps) => {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      description: "",
      instructions: "",
      seed: "",
      src: "",
      categoryId: "",
    },
    mode: "onSubmit",
  });

  const isLoading = form.formState.isSubmitting;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      let id: string;
      if (initialData) {
        await axios.patch(`/api/companion/${initialData.id}`, values);
        id = initialData.id;
      } else {
        const res = await axios.post("/api/companion", values);
        id = res.data.id as string;
      }
      toast.success("Companion saved!");
      router.push(`/companion/${id}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong.");
    }
  }

  return (
    <div className="flex justify-center items-start w-full h-full p-6">
      <div className="w-full max-w-4xl space-y-10">
        {/* RHF provider: ensures JS handles submit (prevents GET with query string) */}
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-10"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold">General Information</h3>
              <p className="text-sm text-muted-foreground">
                General information about your companion
              </p>
              <Separator className="w-3/4 mx-auto bg-primary/10" />
            </div>

            {/* Avatar */}
            <FormField
              control={form.control}
              name="src"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center space-y-4">
                  <FormControl>
                    <ImageUpload
                      disabled={isLoading}
                      onChange={field.onChange}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name + Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="Elon Musk"
                        className="text-center md:text-left"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This is how your AI Companion will be named.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="CEO & Founder of Tesla, SpaceX"
                        className="text-center md:text-left"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Short description for your AI Companion.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    defaultValue={field.value} // keeps shadcn Select happy with RHF
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Select a category for your AI.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Configuration Header */}
            <div className="text-center space-y-2 mt-10">
              <h3 className="text-2xl font-semibold">Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Detailed instructions for AI Behaviour
              </p>
              <Separator className="w-3/4 mx-auto bg-primary/10" />
            </div>

            {/* Instructions */}
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={7}
                      disabled={isLoading}
                      placeholder={PREAMBLE}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seed */}
            <FormField
              control={form.control}
              name="seed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Example Conversation</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={7}
                      disabled={isLoading}
                      placeholder={SEED_CHAT}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="w-full flex justify-center">
              <Button type="submit" disabled={isLoading} size="lg">
                {initialData ? "Edit your companion" : "Create your companion"}
                <Wand2 className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
