"use client";

import Image from "next/image";
import Link from "next/link";
import { Companion } from "@prisma/client";
import { MessagesSquare } from "lucide-react";

import { Card, CardFooter, CardHeader } from "@/components/ui/card";

interface CompanionsProps {
  data: (Companion & {
    _count: {
      messages: number;
    };
  })[];
}

export const Companions = ({ data }: CompanionsProps) => {
  if (data.length === 0) {
    return (
      <div className="pt-10 flex flex-col items-center justify-center space-y-3">
        <div className="relative w-60 h-60">
          <Image
            fill
            className="grayscale"
            alt="Empty"
            src="/empty.png"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          No companions found.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {data.map((item) => (
        <Card
          key={item.id}
          className="bg-secondary border-secondary/20 flex flex-col justify-between"
        >
          <CardHeader className="p-0">
            <Link href={`/chat/${item.id}`} className="block relative w-full aspect-square">
              <Image
                src={item.src}
                alt={item.name}
                fill
                className="object-cover rounded-t-lg"
              />
            </Link>
          </CardHeader>

          <CardFooter className="p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-primary">{item.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            </div>

            <div className="flex items-center text-muted-foreground text-xs">
              <MessagesSquare className="h-3 w-3 mr-1" />
              {item._count.messages}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
