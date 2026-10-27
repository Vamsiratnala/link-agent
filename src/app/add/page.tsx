import { AddPostForm } from "@/components/AddPostForm";

export default function AddPostPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-title-2 sm:text-title-1">Add a post</h1>
      <p className="mt-2 text-body text-fg-2">
        Saw a hiring post on LinkedIn? Copy its text and paste it here. The app finds the email, role and location for you.
      </p>
      <AddPostForm />
    </div>
  );
}
