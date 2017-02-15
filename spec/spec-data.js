/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
export const baseUrl = 'http://host:1234';
export const data = {
   baseUrl,

   ROOT: {
      name: 'Peter',
      age: 34,
      _links: {
         self: { href: baseUrl + '/me' },
         address: [ { href: baseUrl + '/me/address' } ],
         cars: [ { href: baseUrl + '/me/cars' } ],
         car: [
            { href: baseUrl + '/me/cars/0' },
            { href: baseUrl + '/me/cars/1' }
         ],
         pet: { href: baseUrl + '/me/pets/0' }

      },
      _embedded: {
         address: {
            _links: {
               self: { href: baseUrl + '/me/address' }
            },
            street: 'Mainstreet 12',
            postalCode: '12345',
            city: 'Faketown'
         }
      }
   },

   CARS: {
      _links: {
         self: { 'href': baseUrl + '/me/cars' },
         carsByType: { 'href': baseUrl + '/me/carsByType/{type}', templated: true },
         carsByModel: { 'href': baseUrl + '/me/carsByModel{?model}', templated: true },
         carsByTypeAndModel: { 'href': baseUrl + '/me/carsByTypeAndModel{?type}{&model}', templated: true }
      },
      _embedded: {
         car: [
            {
               _links: {
                  self: { href: baseUrl + '/me/cars/0' }
               },
               type: 'VW',
               model: 'T3 Vanagon'
            },
            {
               _links: {
                  self: { href: baseUrl + '/me/cars/1' }
               },
               type: 'DMC',
               model: 'DeLorean'
            }
         ]
      }
   },

   PETS: {
      _links: {
         self: { 'href': baseUrl + '/me/pets' }
      },
      _embedded: {
         pet: [
            {
               _links: {
                  self: { href: baseUrl + '/me/pets/0' }
               },
               type: 'cat',
               color: 'black'
            }
         ]
      }
   }
};
