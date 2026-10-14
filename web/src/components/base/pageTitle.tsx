type Props = {
  description?: string;
  value: string;
};

export const PageTitle = ({ description, value }: Props) => (
  <div className="flex h-50 w-full flex-col items-center justify-center gap-3 text-center">
    <h1 className="text-h2 md:text-h1 sm:max-w-2/3 md:max-w-1/2 lg:max-w-2/5">
      {value}
    </h1>
    {description && (
      <p className="text-mid max-w-130 px-4 text-gray-500">{description}</p>
    )}
  </div>
);
