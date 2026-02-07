export interface ContributorProfile {
  /** Display name (matches recipe frontmatter author field) */
  name: string;
  /** Short bio or description */
  bio?: string;
  /** GitHub username */
  github?: string;
  /** Twitter/X handle (without @) */
  twitter?: string;
  /** Instagram handle (without @) */
  instagram?: string;
  /** Personal website URL */
  website?: string;
  /** Avatar URL (if not provided, falls back to GitHub avatar) */
  avatar?: string;
}

export interface ContributorData {
  /** Map of author slug to profile */
  profiles: Record<string, ContributorProfile>;
}
