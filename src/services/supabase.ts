import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://scgujixohywdgqwkeyda.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZ3VqaXhvaHl3ZGdxd2tleWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNTE3MDksImV4cCI6MjEwNzYyNzcwOX0.Nkp1Cx7VfTU4ZyKsfSYE2n3tV-g0L8h3XpjzeWHCSz8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
