import { Component, OnInit, ElementRef, HostListener } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  switchMap,
  tap,
} from 'rxjs/operators';
import { DataService } from '../../../core/services/data.service';
import { SearchService } from '../../../core/services/search.service'; // Nouveau service
import { PalmTrait } from '../../../core/models/palm-trait.model';
import { CommonModule } from '@angular/common';
import {
  MatFormField,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIconButton } from '@angular/material/button';
import { MatList, MatListItem } from '@angular/material/list';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormField,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatProgressSpinner,
    MatIconButton,
    MatList,
    MatListItem,
  ],
})
export class SearchBarComponent implements OnInit {
  searchControl = new FormControl('');
  searchResults$: Observable<PalmTrait[]>;
  private searchTerms = new Subject<string>();
  loading = false;
  resultsVisible = false; // Pour suivre l'état d'affichage des résultats
  currentResults: PalmTrait[] = []; // Pour stocker les résultats actuels

  constructor(
    private dataService: DataService, 
    private router: Router,
    private elementRef: ElementRef,
    private searchService: SearchService // Injecter le nouveau service
  ) {
    this.searchResults$ = this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter((term) => term.length > 2),
      tap(() => (this.loading = true)),
      switchMap((term) => this.dataService.searchPalms(term)),
      tap((results) => {
        this.loading = false;
        this.resultsVisible = true;
        this.currentResults = results; // Stocker les résultats actuels
      })
    );
  }

  // Détecte les clics en dehors du composant
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.resultsVisible = false; // Cache les résultats
    }
  }

  // Empêche la propagation des clics à l'intérieur de la zone de résultats
  onResultsClick(event: Event) {
    event.stopPropagation();
  }

  ngOnInit(): void {
    this.searchControl.valueChanges.subscribe((term) => {
      if (term && term.trim().length > 2) { // Au moins 3 caractères pour rechercher
        this.searchTerms.next(term);
        this.resultsVisible = true;
        
        // Mise à jour immédiate de la liste principale avec les résultats actuels
        // après un délai pour permettre la recherche de se compléter
        setTimeout(() => {
          if (this.currentResults && this.currentResults.length > 0) {
            console.log("Auto-updating search results:", this.currentResults.length);
            this.searchService.updateSearchResults(this.currentResults);
          }
        }, 500); // Délai de 500ms
      } else if (!term || term.trim().length === 0) {
        // Quand l'utilisateur efface sa recherche, on revient à la liste complète
        this.resultsVisible = false;
        this.searchService.clearSearchResults();
      }
    });
    
    // S'abonner aux résultats pour les stocker
    this.searchResults$.subscribe(results => {
      this.currentResults = results;
    });
  }

  search(term: string): void {
    this.searchTerms.next(term);
  }

  onSearchSubmit(): void {
    const term = this.searchControl.value;
    console.log("onSearchSubmit called with term:", term);
    console.log("Current results:", this.currentResults.length);
    
    if (term && term.trim().length > 0 && this.currentResults.length > 0) {
      console.log("Updating search results in service");
      this.searchService.updateSearchResults(this.currentResults);
      
      // Fermer les résultats déroulants
      this.resultsVisible = false;
    } else if (term && term.trim().length > 0) {
      console.log("Navigating to search page");
      this.router.navigate(['/palms/search'], { queryParams: { q: term } });
    }
  }

  goToPalmDetail(palm: PalmTrait): void {
    // Obtenir le nom d'espèce, en tenant compte de la structure de données
    const speciesName = palm.SpecName || palm.species || '';
    // Convertir en slug URL-friendly
    const speciesSlug = this.slugify(speciesName);
    this.router.navigate(['/palms', speciesSlug]);
    this.searchControl.setValue('');
    this.resultsVisible = false;
  }

  // Obtenir le nom d'espèce pour l'affichage
  getSpeciesName(palm: PalmTrait): string {
    return palm.SpecName || palm.species || 'Unknown Species';
  }

  // Obtenir le genre pour l'affichage
  getGenusName(palm: PalmTrait): string {
    return palm.accGenus || palm.genus || 'Unknown Genus';
  }

  // Fonction utilitaire pour convertir un texte en format slug
  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
      .replace(/[^\w\-]+/g, '') // Supprimer tous les caractères non-word
      .replace(/\-\-+/g, '-') // Remplacer les tirets multiples par un seul
      .replace(/^-+/, '') // Supprimer les tirets au début
      .replace(/-+$/, ''); // Supprimer les tirets à la fin
  }
}